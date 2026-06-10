import Elysia, { t } from 'elysia'
import { onLog, getLogs, isTunnelRunning } from '../services/cloudflared.service'
import { loadConfig } from '../services/config.service'

export const wsRoutes = new Elysia({ prefix: '/ws' })
  .ws('/tunnels/:tunnelId/logs', {
    open(ws) {
      const { tunnelId } = ws.data.params
      const config = loadConfig()
      const tunnel = config.tunnels.find(t => t.id === tunnelId)

      if (!tunnel) {
        ws.send(JSON.stringify({ error: 'Tunnel não encontrado' }))
        ws.close()
        return
      }

      // envia logs anteriores
      const logs = getLogs(tunnel.tunnelId)
      logs.forEach(log => ws.send(JSON.stringify({ log })))

      // subscreve novos logs
      const unsub = onLog(tunnel.tunnelId, (log) => {
        ws.send(JSON.stringify({ log }))
      })

      // guarda o unsubscribe para chamar no close
      ;(ws as any).__unsub = unsub
    },
    close(ws) {
      const unsub = (ws as any).__unsub
      if (typeof unsub === 'function') unsub()
    },
    params: t.Object({ tunnelId: t.String() }),
  })
