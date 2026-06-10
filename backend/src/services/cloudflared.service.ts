import { spawn, type ChildProcess } from 'child_process'
import { existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import { getCertPath, getConfigYmlPath } from './config.service'

interface TunnelProcess {
  process: ChildProcess
  tunnelId: string
  logs: string[]
}

const processes = new Map<string, TunnelProcess>()
const logListeners = new Map<string, Set<(log: string) => void>>()
const MAX_LOGS = 500

function addLog(tunnelId: string, log: string) {
  const tp = processes.get(tunnelId)
  if (tp) {
    tp.logs.push(log)
    if (tp.logs.length > MAX_LOGS) tp.logs.shift()
  }
  const listeners = logListeners.get(tunnelId)
  if (listeners) {
    listeners.forEach(fn => fn(log))
  }
}

export function onLog(tunnelId: string, fn: (log: string) => void): () => void {
  if (!logListeners.has(tunnelId)) {
    logListeners.set(tunnelId, new Set())
  }
  logListeners.get(tunnelId)!.add(fn)
  return () => logListeners.get(tunnelId)?.delete(fn)
}

export function getLogs(tunnelId: string): string[] {
  return processes.get(tunnelId)?.logs || []
}

export function startTunnel(tunnelId: string): boolean {
  if (processes.has(tunnelId)) {
    return false
  }

  const configPath = getConfigYmlPath(tunnelId)
  if (!existsSync(configPath)) {
    throw new Error(`config.yml não encontrado para tunnel ${tunnelId}`)
  }

  const proc = spawn('cloudflared', [
    'tunnel',
    '--config', configPath,
    '--no-autoupdate',
    'run',
  ])

  const tp: TunnelProcess = {
    process: proc,
    tunnelId,
    logs: [],
  }

  processes.set(tunnelId, tp)

  proc.stdout.on('data', (data: Buffer) => {
    addLog(tunnelId, data.toString().trim())
  })

  proc.stderr.on('data', (data: Buffer) => {
    addLog(tunnelId, data.toString().trim())
  })

  proc.on('exit', (code) => {
    addLog(tunnelId, `[flared] processo encerrado com código ${code}`)
    processes.delete(tunnelId)
  })

  return true
}

export function stopTunnel(tunnelId: string): boolean {
  const tp = processes.get(tunnelId)
  if (!tp) return false
  tp.process.kill('SIGTERM')
  processes.delete(tunnelId)
  return true
}

export function restartTunnel(tunnelId: string): boolean {
  stopTunnel(tunnelId)
  setTimeout(() => startTunnel(tunnelId), 500)
  return true
}

export function isTunnelRunning(tunnelId: string): boolean {
  return processes.has(tunnelId)
}

export function getRunningTunnels(): string[] {
  return Array.from(processes.keys())
}

export async function getCloudflaredVersion(): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('cloudflared', ['--version'])
    let output = ''
    proc.stdout.on('data', (d: Buffer) => output += d.toString())
    proc.stderr.on('data', (d: Buffer) => output += d.toString())
    proc.on('exit', () => resolve(output.trim()))
  })
}

export async function updateCloudflared(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', ['update'])
    let output = ''
    proc.stdout.on('data', (d: Buffer) => output += d.toString())
    proc.stderr.on('data', (d: Buffer) => output += d.toString())
    proc.on('exit', (code) => {
      if (code === 0) resolve(output.trim())
      else reject(new Error(output.trim()))
    })
  })
}

export async function runCloudflaredLogin(): Promise<{ url: string; certPath: string }> {
  return new Promise((resolve, reject) => {
    const certPath = getCertPath()
    const proc = spawn('cloudflared', ['tunnel', '--origincert', certPath, 'login'])
    let resolved = false

    proc.stdout.on('data', (d: Buffer) => {
      const text = d.toString()
      const match = text.match(/https:\/\/dash\.cloudflare\.com\/argotunnel[^\s]+/)
      if (match && !resolved) {
        resolved = true
        resolve({ url: match[0], certPath })
      }
    })

    proc.stderr.on('data', (d: Buffer) => {
      const text = d.toString()
      const match = text.match(/https:\/\/dash\.cloudflare\.com\/argotunnel[^\s]+/)
      if (match && !resolved) {
        resolved = true
        resolve({ url: match[0], certPath })
      }
    })

    proc.on('exit', (code) => {
      if (!resolved) reject(new Error(`cloudflared login encerrou com código ${code}`))

      // cloudflared escreve o cert em ~/.cloudflared/cert.pem — copia para CONFIG_DIR
      const defaultCert = join(process.env.HOME || '/root', '.cloudflared', 'cert.pem')
      const targetCert = getCertPath()
      if (code === 0 && existsSync(defaultCert) && !existsSync(targetCert)) {
        try { copyFileSync(defaultCert, targetCert) } catch {}
      }
    })

    setTimeout(() => {
      if (!resolved) reject(new Error('timeout aguardando URL de login'))
    }, 30000)
  })
}

export async function createTunnelCli(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const certPath = getCertPath()
    const proc = spawn('cloudflared', [
      'tunnel',
      '--origincert', certPath,
      'create', name,
    ])
    let output = ''

    proc.stdout.on('data', (d: Buffer) => output += d.toString())
    proc.stderr.on('data', (d: Buffer) => output += d.toString())

    proc.on('exit', (code) => {
      if (code !== 0) return reject(new Error(output))
      const match = output.match(/Created tunnel .+ with id ([a-f0-9-]{36})/i)
      if (match) resolve(match[1])
      else reject(new Error(`não foi possível extrair tunnel ID: ${output}`))
    })
  })
}
