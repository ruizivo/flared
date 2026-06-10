import Elysia, { t } from 'elysia'
import { randomUUID } from 'crypto'
import { authMiddleware } from '../middleware/auth.middleware'
import { loadConfig, saveConfig } from '../services/config.service'
import { writeConfigYml } from '../services/configYml.service'
import { restartTunnel, isTunnelRunning } from '../services/cloudflared.service'
import { createCNAME, deleteCNAME } from '../services/cloudflare.service'

export const hostnameRoutes = new Elysia({ prefix: '/tunnels/:tunnelId/hostnames' })
  .use(authMiddleware)
  .get('/', ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
    return tunnel.hostnames
  })
  .post(
    '/',
    async ({ params, body, set }) => {
      const config = loadConfig()
      const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
      if (!tunnel) {
        set.status = 404
        return { error: 'Tunnel não encontrado' }
      }

      const zone = config.zones.find(z => body.hostname.endsWith(z.domain))
      if (!zone) {
        set.status = 400
        return { error: `Nenhuma zone cadastrada cobre o domínio ${body.hostname}` }
      }

      const hostname = {
        id: randomUUID(),
        hostname: body.hostname,
        service: body.service,
        noTLSVerify: body.noTLSVerify ?? false,
        httpHostHeader: body.httpHostHeader ?? body.hostname,
        active: true,
        zoneId: zone.id,
      }

      try {
        await createCNAME(zone, body.hostname, tunnel.tunnelId)
      } catch (err: any) {
        set.status = 500
        return { error: `Erro ao criar CNAME: ${err.message}` }
      }

      tunnel.hostnames.push(hostname)
      saveConfig(config)
      writeConfigYml(tunnel)

      if (isTunnelRunning(tunnel.tunnelId)) {
        restartTunnel(tunnel.tunnelId)
      }

      return hostname
    },
    {
      body: t.Object({
        hostname: t.String(),
        service: t.String(),
        noTLSVerify: t.Optional(t.Boolean()),
        httpHostHeader: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    '/:hostnameId',
    async ({ params, body, set }) => {
      const config = loadConfig()
      const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
      if (!tunnel) {
        set.status = 404
        return { error: 'Tunnel não encontrado' }
      }

      const hostname = tunnel.hostnames.find(h => h.id === params.hostnameId)
      if (!hostname) {
        set.status = 404
        return { error: 'Hostname não encontrado' }
      }

      Object.assign(hostname, body)
      saveConfig(config)
      writeConfigYml(tunnel)

      if (isTunnelRunning(tunnel.tunnelId)) {
        restartTunnel(tunnel.tunnelId)
      }

      return hostname
    },
    {
      body: t.Object({
        service: t.Optional(t.String()),
        noTLSVerify: t.Optional(t.Boolean()),
        httpHostHeader: t.Optional(t.String()),
        active: t.Optional(t.Boolean()),
      }),
    }
  )
  .post('/:hostnameId/toggle', async ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }

    const hostname = tunnel.hostnames.find(h => h.id === params.hostnameId)
    if (!hostname) {
      set.status = 404
      return { error: 'Hostname não encontrado' }
    }

    const zone = config.zones.find(z => z.id === hostname.zoneId)
    if (!zone) {
      set.status = 400
      return { error: 'Zone não encontrada' }
    }

    hostname.active = !hostname.active

    try {
      if (hostname.active) {
        await createCNAME(zone, hostname.hostname, tunnel.tunnelId)
      } else {
        await deleteCNAME(zone, hostname.hostname)
      }
    } catch (err: any) {
      hostname.active = !hostname.active
      set.status = 500
      return { error: `Erro ao atualizar DNS: ${err.message}` }
    }

    saveConfig(config)
    writeConfigYml(tunnel)

    if (isTunnelRunning(tunnel.tunnelId)) {
      restartTunnel(tunnel.tunnelId)
    }

    return hostname
  })
  .delete('/:hostnameId', async ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }

    const idx = tunnel.hostnames.findIndex(h => h.id === params.hostnameId)
    if (idx === -1) {
      set.status = 404
      return { error: 'Hostname não encontrado' }
    }

    const hostname = tunnel.hostnames[idx]
    const zone = config.zones.find(z => z.id === hostname.zoneId)

    if (zone) {
      try {
        await deleteCNAME(zone, hostname.hostname)
      } catch (err: any) {
        console.error(`Erro ao deletar CNAME: ${err.message}`)
      }
    }

    tunnel.hostnames.splice(idx, 1)
    saveConfig(config)
    writeConfigYml(tunnel)

    if (isTunnelRunning(tunnel.tunnelId)) {
      restartTunnel(tunnel.tunnelId)
    }

    return { success: true }
  })
