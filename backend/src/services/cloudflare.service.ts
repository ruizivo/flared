import type { CloudflareApiRecord, CfZone } from '../types'

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

export async function listZones(token: string): Promise<CfZone[]> {
  const zones = await cfFetch(token, '/zones?per_page=100')
  return (zones || []).map((z: any) => ({ id: z.id, name: z.name }))
}

export async function createCNAME(token: string, cfZoneId: string, hostname: string, tunnelId: string): Promise<string> {
  console.log(`[cloudflare-api] criando CNAME: ${hostname} → ${tunnelId}.cfargotunnel.com`)
  const record = await cfFetch(token, `/zones/${cfZoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'CNAME',
      name: hostname,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
    }),
  })
  console.log(`[cloudflare-api] CNAME criado (id: ${record.id})`)
  return record.id
}

export async function deleteCNAME(token: string, cfZoneId: string, hostname: string): Promise<void> {
  console.log(`[cloudflare-api] deletando CNAME: ${hostname}`)
  const records = await listCNAMEs(token, cfZoneId, hostname)
  if (records.length === 0) {
    console.log(`[cloudflare-api] nenhum CNAME encontrado para ${hostname}`)
    return
  }
  for (const record of records) {
    await cfFetch(token, `/zones/${cfZoneId}/dns_records/${record.id}`, {
      method: 'DELETE',
    })
    console.log(`[cloudflare-api] CNAME ${record.id} deletado`)
  }
}

export async function listCNAMEs(token: string, cfZoneId: string, hostname?: string): Promise<CloudflareApiRecord[]> {
  const query = hostname ? `?type=CNAME&name=${hostname}` : `?type=CNAME`
  return cfFetch(token, `/zones/${cfZoneId}/dns_records${query}`)
}

export async function getAccountId(token: string, cfZoneId: string): Promise<string> {
  const zone = await cfFetch(token, `/zones/${cfZoneId}`)
  return zone.account.id
}

export async function listCloudflareTunnels(token: string, accountId: string): Promise<{ id: string; name: string; status: string; created_at: string }[]> {
  console.log(`[cloudflare-api] listando tunnels da conta ${accountId}`)
  return cfFetch(token, `/accounts/${accountId}/cfd_tunnel?is_deleted=false`)
}
