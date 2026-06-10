import type { CloudflareApiRecord, Zone } from '../types'

const CF_API = 'https://api.cloudflare.com/client/v4'

async function cfFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const data = await res.json() as any
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || 'Cloudflare API error')
  }
  return data.result
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    await cfFetch(token, '/user/tokens/verify')
    return true
  } catch {
    return false
  }
}

export async function getZoneDetails(token: string, zoneId: string) {
  return cfFetch(token, `/zones/${zoneId}`)
}

export async function createCNAME(zone: Zone, hostname: string, tunnelId: string): Promise<string> {
  const subdomain = hostname.replace(`.${zone.domain}`, '')
  const record = await cfFetch(zone.apiToken, `/zones/${zone.zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'CNAME',
      name: subdomain,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
    }),
  })
  return record.id
}

export async function deleteCNAME(zone: Zone, hostname: string): Promise<void> {
  const records = await listCNAMEs(zone, hostname)
  for (const record of records) {
    await cfFetch(zone.apiToken, `/zones/${zone.zoneId}/dns_records/${record.id}`, {
      method: 'DELETE',
    })
  }
}

export async function listCNAMEs(zone: Zone, hostname?: string): Promise<CloudflareApiRecord[]> {
  const query = hostname
    ? `?type=CNAME&name=${hostname}`
    : `?type=CNAME`
  return cfFetch(zone.apiToken, `/zones/${zone.zoneId}/dns_records${query}`)
}

export async function cnameExists(zone: Zone, hostname: string): Promise<boolean> {
  const records = await listCNAMEs(zone, hostname)
  return records.length > 0
}

export async function getAccountId(token: string, zoneId: string): Promise<string> {
  const zone = await cfFetch(token, `/zones/${zoneId}`)
  return zone.account.id
}

export async function listCloudflareTunnels(token: string, accountId: string): Promise<{ id: string; name: string; status: string; created_at: string }[]> {
  return cfFetch(token, `/accounts/${accountId}/cfd_tunnel?is_deleted=false`)
}
