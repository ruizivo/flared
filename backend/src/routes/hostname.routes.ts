import Elysia, { t } from 'elysia'
import { randomUUID } from 'crypto'
import { authMiddleware } from '../middleware/auth.middleware'
import { loadConfig, saveConfig } from '../services/config.service'
import { writeConfigYml } from '../services/configYml.service'
import { restartTunnel, isTunnelRunning } from '../services/cloudflared.service'
import { createCNAME, deleteCNAME } from '../services/cloudflare.service'
import { getZonesForAccount, findZoneForHostname } from '../services/zoneCache.service'

function getAccountForTunnel(tunnelId: string) {
  const config = loadConfig()
  const tunnel = config.tunnels.find(t => t.id === tunnelId)
  if (!tunnel) return { error: 'Tunnel não encontrado' as const, tunnel: null, account: null, config }
  const account = config.accounts.find(a => a.id === tunnel.accountId)
  if (!account) return { error: 'Conta associada ao tunnel não encontrada' as const, tunnel, account: null, config }
  return { error: null, tunnel, account, config }
}

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
      const { error, tunnel, account, config } = getAccountForTunnel(params.tunnelId)
      if (!tunnel) { set.status = 404; return { error: 'Tunnel não encontrado' } }
      if (!account) { set.status = 400; return { error: error || 'Conta não encontrada' } }

      let zones: any[]
      try {
        zones = await getZonesForAccount(account)
      } catch (err: any) {
        set.status = 502
        return { error: `Erro ao buscar zones da conta: ${err.message}` }
      }

      const zone = findZoneForHostname(zones, body.hostname)
      if (!zone) {
        set.status = 400
        return { error: `Nenhuma zone na conta "${account.name}" cobre o domínio ${body.hostname}` }
      }

      console.log(`[hostname] adicionando ${body.hostname} → ${body.service} (tunnel: ${tunnel.name})`)

      const hostname = {
        id: randomUUID(),
        hostname: body.hostname,
        service: body.service,
        noTLSVerify: body.noTLSVerify ?? false,
        httpHostHeader: body.httpHostHeader ?? body.hostname,
        active: true,
        cfZoneId: zone.id,
      }

      try {
        await createCNAME(account.apiToken, zone.id, body.hostname, tunnel.tunnelId)
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
    const { error, tunnel, account, config } = getAccountForTunnel(params.tunnelId)
    if (!tunnel) { set.status = 404; return { error: 'Tunnel não encontrado' } }
    if (!account) { set.status = 400; return { error: error || 'Conta não encontrada' } }

    const hostname = tunnel.hostnames.find(h => h.id === params.hostnameId)
    if (!hostname) {
      set.status = 404
      return { error: 'Hostname não encontrado' }
    }

    const newState = !hostname.active
    console.log(`[hostname] toggle ${hostname.hostname}: ${hostname.active ? 'ativo→inativo' : 'inativo→ativo'} (tunnel: ${tunnel.name})`)

    hostname.active = newState

    try {
      if (hostname.active) {
        console.log(`[hostname] criando CNAME para ${hostname.hostname}`)
        await createCNAME(account.apiToken, hostname.cfZoneId, hostname.hostname, tunnel.tunnelId)
      } else {
        console.log(`[hostname] deletando CNAME para ${hostname.hostname}`)
        await deleteCNAME(account.apiToken, hostname.cfZoneId, hostname.hostname)
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
    const { error: accountError, tunnel, account, config } = getAccountForTunnel(params.tunnelId)
    if (!tunnel) { set.status = 404; return { error: 'Tunnel não encontrado' } }

    const idx = tunnel.hostnames.findIndex(h => h.id === params.hostnameId)
    if (idx === -1) {
      set.status = 404
      return { error: 'Hostname não encontrado' }
    }

    const hostname = tunnel.hostnames[idx]
    console.log(`[hostname] deletando ${hostname.hostname} (tunnel: ${tunnel.name})`)

    if (account && hostname.cfZoneId) {
      try {
        await deleteCNAME(account.apiToken, hostname.cfZoneId, hostname.hostname)
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
