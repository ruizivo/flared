import { listZones } from './cloudflare.service'
import type { Account, CfZone } from '../types'

const CACHE_TTL = 5 * 60 * 1000

interface CacheEntry {
  zones: CfZone[]
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

export async function getZonesForAccount(account: Account): Promise<CfZone[]> {
  const entry = cache.get(account.id)
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) {
    return entry.zones
  }
  console.log(`[zone-cache] buscando zones para conta "${account.name}"...`)
  const zones = await listZones(account.apiToken)
  cache.set(account.id, { zones, fetchedAt: Date.now() })
  console.log(`[zone-cache] ${zones.length} zone(s) para conta "${account.name}"`)
  return zones
}

export function invalidateAccountCache(accountId: string) {
  cache.delete(accountId)
  console.log(`[zone-cache] cache invalidado para conta ${accountId}`)
}

export function findZoneForHostname(zones: CfZone[], hostname: string): CfZone | undefined {
  return zones
    .slice()
    .sort((a, b) => b.name.length - a.name.length)
    .find(z => hostname === z.name || hostname.endsWith('.' + z.name))
}
