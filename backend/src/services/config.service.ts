import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { AppConfig } from '../types'

const CONFIG_DIR = process.env.FLARED_CONFIG_DIR || '/config'
const CONFIG_FILE = join(CONFIG_DIR, 'app-config.json')

export function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  const tunnelsDir = join(CONFIG_DIR, 'tunnels')
  if (!existsSync(tunnelsDir)) {
    mkdirSync(tunnelsDir, { recursive: true })
  }
}

function migrateIfNeeded(raw: any): AppConfig {
  // Migrate old zones[] → accounts[]
  if (Array.isArray(raw.zones) && !Array.isArray(raw.accounts)) {
    console.log('[migração] convertendo zones[] para accounts[]...')

    const tokenToAccountId = new Map<string, string>()
    const accounts: AppConfig['accounts'] = []

    for (const zone of raw.zones as any[]) {
      if (!tokenToAccountId.has(zone.apiToken)) {
        const id = randomUUID()
        tokenToAccountId.set(zone.apiToken, id)
        accounts.push({ id, name: zone.domain || `Conta ${accounts.length + 1}`, apiToken: zone.apiToken })
      }
    }

    const zoneIdToInfo = new Map<string, { cfZoneId: string; accountId: string }>()
    for (const zone of raw.zones as any[]) {
      zoneIdToInfo.set(zone.id, {
        cfZoneId: zone.zoneId,
        accountId: tokenToAccountId.get(zone.apiToken)!,
      })
    }

    const tunnels = (raw.tunnels || []).map((tunnel: any) => {
      let accountId = accounts[0]?.id || ''
      const hostnames = (tunnel.hostnames || []).map((h: any) => {
        const info = zoneIdToInfo.get(h.zoneId)
        if (info && !accountId) accountId = info.accountId
        const { zoneId: _removed, ...rest } = h
        return { ...rest, cfZoneId: info?.cfZoneId || h.zoneId || '' }
      })
      if (!accountId) accountId = accounts[0]?.id || ''
      const { hostnames: _h, ...tunnelRest } = tunnel
      return { ...tunnelRest, accountId, hostnames }
    })

    const migrated: AppConfig = { accounts, tunnels }
    writeFileSync(CONFIG_FILE, JSON.stringify(migrated, null, 2))
    console.log(`[migração] ${accounts.length} conta(s) criada(s) a partir de ${raw.zones.length} zone(s)`)
    return migrated
  }

  return {
    accounts: raw.accounts || [],
    tunnels: raw.tunnels || [],
  }
}

export function loadConfig(): AppConfig {
  ensureConfigDir()
  if (!existsSync(CONFIG_FILE)) {
    const defaultConfig: AppConfig = { accounts: [], tunnels: [] }
    saveConfig(defaultConfig)
    return defaultConfig
  }
  const raw = readFileSync(CONFIG_FILE, 'utf-8')
  return migrateIfNeeded(JSON.parse(raw))
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
