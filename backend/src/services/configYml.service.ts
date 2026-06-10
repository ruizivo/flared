import { writeFileSync } from 'fs'
import * as YAML from 'yaml'
import type { Tunnel, CloudflaredConfig } from '../types'
import { getConfigYmlPath, getCredentialsPath } from './config.service'

function resolveService(service: string): string {
  const gateway = process.env.FLARED_HOST_GATEWAY
  if (!gateway) return service
  return service.replace(/localhost/g, gateway).replace(/127\.0\.0\.1/g, gateway)
}

export function generateConfigYml(tunnel: Tunnel): string {
  const activeHostnames = tunnel.hostnames.filter(h => h.active)

  const ingress = activeHostnames.map(h => {
    const entry: any = {
      hostname: h.hostname,
      service: resolveService(h.service),
    }
    if (h.noTLSVerify || h.httpHostHeader) {
      entry.originRequest = {}
      if (h.noTLSVerify) entry.originRequest.noTLSVerify = true
      if (h.httpHostHeader) entry.originRequest.httpHostHeader = h.httpHostHeader
    }
    return entry
  })

  // regra catch-all obrigatória
  ingress.push({ service: 'http_status:404' })

  const config: CloudflaredConfig = {
    tunnel: tunnel.tunnelId,
    'credentials-file': getCredentialsPath(tunnel.tunnelId),
    ingress,
  }

  return YAML.stringify(config)
}

export function writeConfigYml(tunnel: Tunnel) {
  const content = generateConfigYml(tunnel)
  const path = getConfigYmlPath(tunnel.tunnelId)
  writeFileSync(path, content)
  return path
}
