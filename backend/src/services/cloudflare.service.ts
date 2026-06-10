import type { CloudflareApiRecord, Zone } from '../types'

const CF_API = 'https://api.cloudflare.com/client/v4'

async function cfFetch(token: string, path: string, options?: RequestInit) {
  const method = options?.method || 'GET'
  console.log(`[cloudflare-api] ${method} ${path}`)
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
    const msg = data.errors?.[0]?.message || 'Cloudflare API error'
    console.error(`[cloudflare-api] erro em ${method} ${path}: ${msg}`)
    throw new Error(msg)
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
  console.log(`[cloudflare-api] criando CNAME: ${hostname} → ${tunnelId}.cfargotunnel.com (zone: ${zone.domain})`)
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
  console.log(`[cloudflare-api] CNAME criado (id: ${record.id})`)
  return record.id
}

export async function deleteCNAME(zone: Zone, hostname: string): Promise<void> {
  console.log(`[cloudflare-api] deletando CNAME: ${hostname} (zone: ${zone.domain})`)
  const records = await listCNAMEs(zone, hostname)
  if (records.length === 0) {
    console.log(`[cloudflare-api] nenhum CNAME encontrado para ${hostname}`)
    return
  }
  for (const record of records) {
    await cfFetch(zone.apiToken, `/zones/${zone.zoneId}/dns_records/${record.id}`, {
      method: 'DELETE',
    })
    console.log(`[cloudflare-api] CNAME ${record.id} deletado`)
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
  console.log(`[cloudflare-api] listando tunnels da conta ${accountId}`)
  return cfFetch(token, `/accounts/${accountId}/cfd_tunnel?is_deleted=false`)
}
