import Elysia, { t } from 'elysia'
import { authMiddleware } from '../middleware/auth.middleware'
import { loadConfig, saveConfig } from '../services/config.service'
import { writeConfigYml } from '../services/configYml.service'
import {
  startTunnel,
  stopTunnel,
  restartTunnel,
  isTunnelRunning,
  getLogs,
  getCloudflaredVersion,
  updateCloudflared,
} from '../services/cloudflared.service'

export const tunnelRoutes = new Elysia({ prefix: '/tunnels' })
  .use(authMiddleware)
  .get('/', () => {
    const config = loadConfig()
    return config.tunnels.map(t => ({
      ...t,
      running: isTunnelRunning(t.tunnelId),
    }))
  })
  .get('/:tunnelId', ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
    return { ...tunnel, running: isTunnelRunning(tunnel.tunnelId) }
  })
  .delete('/:tunnelId', ({ params, set }) => {
    const config = loadConfig()
    const idx = config.tunnels.findIndex(t => t.id === params.tunnelId)
    if (idx === -1) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
    const tunnel = config.tunnels[idx]
    console.log(`[tunnel] deletando ${tunnel.name} (${tunnel.tunnelId})`)
    if (isTunnelRunning(tunnel.tunnelId)) {
      stopTunnel(tunnel.tunnelId)
    }
    config.tunnels.splice(idx, 1)
    saveConfig(config)
    console.log(`[tunnel] ${tunnel.name} removido da configuração`)
    return { success: true }
  })
  .post('/:tunnelId/start', ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
    if (isTunnelRunning(tunnel.tunnelId)) {
      console.log(`[tunnel] start: ${tunnel.name} já está rodando`)
      return { message: 'Tunnel já está rodando' }
    }
    console.log(`[tunnel] iniciando ${tunnel.name} (${tunnel.tunnelId})`)
    tunnel.active = true
    saveConfig(config)
    try {
      startTunnel(tunnel.tunnelId)
    } catch (err: any) {
      console.error(`[tunnel] erro ao iniciar ${tunnel.name}: ${err.message}`)
      set.status = 500
      return { error: err.message }
    }
    return { success: true }
  })
  .post('/:tunnelId/stop', ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
    console.log(`[tunnel] parando ${tunnel.name} (${tunnel.tunnelId})`)
    tunnel.active = false
    saveConfig(config)
    stopTunnel(tunnel.tunnelId)
    return { success: true }
  })
  .post('/:tunnelId/restart', ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
    console.log(`[tunnel] reiniciando ${tunnel.name} (${tunnel.tunnelId})`)
    restartTunnel(tunnel.tunnelId)
    return { success: true }
  })
  .get('/:tunnelId/logs', ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
    return { logs: getLogs(tunnel.tunnelId) }
  })
  .get('/system/version', async () => {
    const version = await getCloudflaredVersion()
    return { version }
  })
  .get('/system/latest', async ({ set }) => {
    try {
      console.log('[cloudflared] consultando última versão no GitHub...')
      const res = await fetch(
        'https://api.github.com/repos/cloudflare/cloudflared/releases/latest',
        { headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'flared-app' } }
      )
      if (!res.ok) throw new Error(`GitHub API retornou ${res.status}`)
      const data = await res.json() as any
      const latest = (data.tag_name as string).replace(/^v/, '')
      console.log(`[cloudflared] última versão disponível: ${latest}`)
      return { latest }
    } catch (err: any) {
      console.error(`[cloudflared] erro ao buscar versão mais recente: ${err.message}`)
      set.status = 502
      return { error: err.message }
    }
  })
  .post('/system/update', async ({ set }) => {
    try {
      const result = await updateCloudflared()
      return { success: true, output: result }
    } catch (err: any) {
      set.status = 500
      return { error: err.message }
    }
  })
