import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { AppConfig, Tunnel, Zone } from '../types'

const CONFIG_DIR = process.env.FLARED_CONFIG_DIR || '/config'
const CONFIG_FILE = join(CONFIG_DIR, 'app-config.json')

const defaultConfig: AppConfig = {
  zones: [],
  tunnels: [],
}

export function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  const tunnelsDir = join(CONFIG_DIR, 'tunnels')
  if (!existsSync(tunnelsDir)) {
    mkdirSync(tunnelsDir, { recursive: true })
  }
}

export function loadConfig(): AppConfig {
  ensureConfigDir()
  if (!existsSync(CONFIG_FILE)) {
    saveConfig(defaultConfig)
    return defaultConfig
  }
  const raw = readFileSync(CONFIG_FILE, 'utf-8')
  return JSON.parse(raw)
}

export function saveConfig(config: AppConfig) {
  ensureConfigDir()
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function getTunnelDir(tunnelId: string): string {
  return join(CONFIG_DIR, 'tunnels', tunnelId)
}

export function ensureTunnelDir(tunnelId: string): string {
  const dir = getTunnelDir(tunnelId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getCertPath(): string {
  return join(CONFIG_DIR, 'cert.pem')
}

export function hasCert(): boolean {
  return existsSync(getCertPath())
}

export function getCredentialsPath(tunnelId: string): string {
  return join(getTunnelDir(tunnelId), `${tunnelId}.json`)
}

export function hasCredentials(tunnelId: string): boolean {
  return existsSync(getCredentialsPath(tunnelId))
}

export function getConfigYmlPath(tunnelId: string): string {
  return join(getTunnelDir(tunnelId), 'config.yml')
}
