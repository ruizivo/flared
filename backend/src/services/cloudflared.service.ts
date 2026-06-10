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
    console.log(`[cloudflared] tunnel ${tunnelId} já está rodando`)
    return false
  }

  const configPath = getConfigYmlPath(tunnelId)
  if (!existsSync(configPath)) {
    throw new Error(`config.yml não encontrado para tunnel ${tunnelId}`)
  }

  console.log(`[cloudflared] iniciando tunnel ${tunnelId}`)
  console.log(`[cloudflared] config: ${configPath}`)

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
    const msg = `[flared] processo encerrado com código ${code}`
    addLog(tunnelId, msg)
    console.log(`[cloudflared] ${tunnelId}: ${msg}`)
    // só remove do map se este ainda é o processo ativo — evita race condition no restart
    if (processes.get(tunnelId)?.process === proc) {
      processes.delete(tunnelId)
    }
  })

  console.log(`[cloudflared] tunnel ${tunnelId} iniciado (pid ${proc.pid})`)
  return true
}

export function stopTunnel(tunnelId: string): boolean {
  const tp = processes.get(tunnelId)
  if (!tp) {
    console.log(`[cloudflared] stopTunnel: ${tunnelId} não estava rodando`)
    return false
  }
  console.log(`[cloudflared] parando tunnel ${tunnelId} (pid ${tp.process.pid})`)
  tp.process.kill('SIGTERM')
  processes.delete(tunnelId)
  return true
}

export function restartTunnel(tunnelId: string): void {
  const tp = processes.get(tunnelId)
  if (!tp) {
    console.log(`[cloudflared] restartTunnel: ${tunnelId} não estava rodando, iniciando...`)
    try { startTunnel(tunnelId) } catch (err: any) {
      console.error(`[cloudflared] erro ao iniciar ${tunnelId}: ${err.message}`)
    }
    return
  }

  console.log(`[cloudflared] reiniciando tunnel ${tunnelId} (pid ${tp.process.pid})`)
  // remove do map antes de matar para que startTunnel possa ser chamado sem conflito
  processes.delete(tunnelId)

  const doStart = () => {
    console.log(`[cloudflared] processo anterior encerrado, iniciando novo para ${tunnelId}`)
    try { startTunnel(tunnelId) } catch (err: any) {
      console.error(`[cloudflared] erro ao reiniciar ${tunnelId}: ${err.message}`)
    }
  }

  tp.process.once('exit', doStart)
  tp.process.kill('SIGTERM')

  // fallback: se SIGTERM não resultar em exit em 3s, força reinício
  setTimeout(() => {
    tp.process.removeListener('exit', doStart)
    if (!processes.has(tunnelId)) {
      console.log(`[cloudflared] timeout SIGTERM para ${tunnelId}, forçando reinício`)
      try { startTunnel(tunnelId) } catch (err: any) {
        console.error(`[cloudflared] erro no reinício forçado de ${tunnelId}: ${err.message}`)
      }
    }
  }, 3000)
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
    console.log('[cloudflared] iniciando atualização...')
    const proc = spawn('cloudflared', ['update'])
    let output = ''
    proc.stdout.on('data', (d: Buffer) => output += d.toString())
    proc.stderr.on('data', (d: Buffer) => output += d.toString())
    proc.on('exit', (code) => {
      console.log(`[cloudflared] atualização encerrada com código ${code}`)
      if (code === 0) resolve(output.trim())
      else reject(new Error(output.trim()))
    })
  })
}

export async function runCloudflaredLogin(): Promise<{ url: string; certPath: string }> {
  return new Promise((resolve, reject) => {
    const certPath = getCertPath()
    console.log(`[cloudflared] iniciando login (cert destino: ${certPath})`)
    const proc = spawn('cloudflared', ['tunnel', '--origincert', certPath, 'login'])
    let resolved = false

    const handleOutput = (text: string) => {
      const match = text.match(/https:\/\/dash\.cloudflare\.com\/argotunnel[^\s]+/)
      if (match && !resolved) {
        resolved = true
        console.log(`[cloudflared] URL de login obtida`)
        resolve({ url: match[0], certPath })
      }
    }

    proc.stdout.on('data', (d: Buffer) => handleOutput(d.toString()))
    proc.stderr.on('data', (d: Buffer) => handleOutput(d.toString()))

    proc.on('exit', (code) => {
      console.log(`[cloudflared] login encerrado com código ${code}`)
      if (!resolved) reject(new Error(`cloudflared login encerrou com código ${code}`))

      // cloudflared escreve o cert em ~/.cloudflared/cert.pem — copia para CONFIG_DIR
      const defaultCert = join(process.env.HOME || '/root', '.cloudflared', 'cert.pem')
      const targetCert = getCertPath()
      if (code === 0 && existsSync(defaultCert) && !existsSync(targetCert)) {
        try {
          copyFileSync(defaultCert, targetCert)
          console.log(`[cloudflared] cert.pem copiado de ${defaultCert} para ${targetCert}`)
        } catch (err: any) {
          console.error(`[cloudflared] erro ao copiar cert.pem: ${err.message}`)
        }
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
    console.log(`[cloudflared] criando tunnel "${name}" (cert: ${certPath})`)
    const proc = spawn('cloudflared', [
      'tunnel',
      '--origincert', certPath,
      'create', name,
    ])
    let output = ''

    proc.stdout.on('data', (d: Buffer) => output += d.toString())
    proc.stderr.on('data', (d: Buffer) => output += d.toString())

    proc.on('exit', (code) => {
      console.log(`[cloudflared] criação do tunnel "${name}" encerrada com código ${code}`)
      if (code !== 0) return reject(new Error(output))
      const match = output.match(/Created tunnel .+ with id ([a-f0-9-]{36})/i)
      if (match) {
        console.log(`[cloudflared] tunnel criado: ${match[1]}`)
        resolve(match[1])
      } else {
        reject(new Error(`não foi possível extrair tunnel ID: ${output}`))
      }
    })
  })
}
