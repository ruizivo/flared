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
    if (isTunnelRunning(tunnel.tunnelId)) {
      stopTunnel(tunnel.tunnelId)
    }
    config.tunnels.splice(idx, 1)
    saveConfig(config)
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
      return { message: 'Tunnel já está rodando' }
    }
    tunnel.active = true
    saveConfig(config)
    startTunnel(tunnel.tunnelId)
    return { success: true }
  })
  .post('/:tunnelId/stop', ({ params, set }) => {
    const config = loadConfig()
    const tunnel = config.tunnels.find(t => t.id === params.tunnelId)
    if (!tunnel) {
      set.status = 404
      return { error: 'Tunnel não encontrado' }
    }
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
  .post('/system/update', async ({ set }) => {
    try {
      const result = await updateCloudflared()
      return { success: true, output: result }
    } catch (err: any) {
      set.status = 500
      return { error: err.message }
    }
  })
