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

      console.log(`[hostname] adicionando ${body.hostname} → ${body.service} (tunnel: ${tunnel.name})`)

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
        console.error(`[hostname] erro ao criar CNAME para ${body.hostname}: ${err.message}`)
        set.status = 500
        return { error: `Erro ao criar CNAME: ${err.message}` }
      }

      tunnel.hostnames.push(hostname)
      saveConfig(config)
      writeConfigYml(tunnel)
      console.log(`[hostname] ${body.hostname} adicionado com sucesso`)

      if (isTunnelRunning(tunnel.tunnelId)) {
        console.log(`[hostname] reiniciando tunnel ${tunnel.name} para aplicar mudanças`)
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

      console.log(`[hostname] atualizando ${hostname.hostname} (tunnel: ${tunnel.name})`, body)
      Object.assign(hostname, body)
      saveConfig(config)
      writeConfigYml(tunnel)

      if (isTunnelRunning(tunnel.tunnelId)) {
        console.log(`[hostname] reiniciando tunnel ${tunnel.name} para aplicar mudanças`)
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

    const newState = !hostname.active
    console.log(`[hostname] toggle ${hostname.hostname}: ${hostname.active ? 'ativo→inativo' : 'inativo→ativo'} (tunnel: ${tunnel.name})`)

    hostname.active = newState

    try {
      if (hostname.active) {
        console.log(`[hostname] criando CNAME para ${hostname.hostname}`)
        await createCNAME(zone, hostname.hostname, tunnel.tunnelId)
      } else {
        console.log(`[hostname] deletando CNAME para ${hostname.hostname}`)
        await deleteCNAME(zone, hostname.hostname)
      }
    } catch (err: any) {
      hostname.active = !hostname.active
      console.error(`[hostname] erro ao atualizar DNS para ${hostname.hostname}: ${err.message}`)
      set.status = 500
      return { error: `Erro ao atualizar DNS: ${err.message}` }
    }

    saveConfig(config)
    writeConfigYml(tunnel)
    console.log(`[hostname] toggle ${hostname.hostname} concluído, active=${hostname.active}`)

    if (isTunnelRunning(tunnel.tunnelId)) {
      console.log(`[hostname] reiniciando tunnel ${tunnel.name} para aplicar mudanças`)
      restartTunnel(tunnel.tunnelId)
    } else {
      console.log(`[hostname] tunnel ${tunnel.name} não está rodando, sem restart necessário`)
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

    console.log(`[hostname] deletando ${hostname.hostname} (tunnel: ${tunnel.name})`)

    if (zone) {
      try {
        await deleteCNAME(zone, hostname.hostname)
        console.log(`[hostname] CNAME de ${hostname.hostname} deletado`)
      } catch (err: any) {
        console.error(`[hostname] erro ao deletar CNAME de ${hostname.hostname}: ${err.message}`)
      }
    }

    tunnel.hostnames.splice(idx, 1)
    saveConfig(config)
    writeConfigYml(tunnel)
    console.log(`[hostname] ${hostname.hostname} removido da configuração`)

    if (isTunnelRunning(tunnel.tunnelId)) {
      console.log(`[hostname] reiniciando tunnel ${tunnel.name} para aplicar mudanças`)
      restartTunnel(tunnel.tunnelId)
    }

    return { success: true }
  })
