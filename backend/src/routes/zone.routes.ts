import Elysia, { t } from 'elysia'
import { randomUUID } from 'crypto'
import { authMiddleware } from '../middleware/auth.middleware'
import { loadConfig, saveConfig } from '../services/config.service'
import { validateToken, getZoneDetails } from '../services/cloudflare.service'

export const zoneRoutes = new Elysia({ prefix: '/zones' })
  .use(authMiddleware)
  .get('/', () => {
    const config = loadConfig()
    return config.zones.map(z => ({
      ...z,
      apiToken: '***',
    }))
  })
  .post(
    '/',
    async ({ body, set }) => {
      const valid = await validateToken(body.apiToken)
      if (!valid) {
        set.status = 400
        return { error: 'API Token inválido' }
      }

      let domain = body.domain
      if (!domain) {
        try {
          const details = await getZoneDetails(body.apiToken, body.zoneId)
          domain = details.name
        } catch (err: any) {
          set.status = 400
          return { error: `Não foi possível obter domínio da zone: ${err.message}` }
        }
      }

      const config = loadConfig()
      const existing = config.zones.find(z => z.zoneId === body.zoneId)
      if (existing) {
        set.status = 400
        return { error: 'Zone já cadastrada' }
      }

      const zone = {
        id: randomUUID(),
        zoneId: body.zoneId,
        domain,
        apiToken: body.apiToken,
      }

      config.zones.push(zone)
      saveConfig(config)

      return { ...zone, apiToken: '***' }
    },
    {
      body: t.Object({
        zoneId: t.String(),
        apiToken: t.String(),
        domain: t.Optional(t.String()),
      }),
    }
  )
  .put(
    '/:id',
    async ({ params, body, set }) => {
      const config = loadConfig()
      const zone = config.zones.find(z => z.id === params.id)
      if (!zone) {
        set.status = 404
        return { error: 'Zone não encontrada' }
      }

      if (body.apiToken) {
        const valid = await validateToken(body.apiToken)
        if (!valid) {
          set.status = 400
          return { error: 'API Token inválido' }
        }
        zone.apiToken = body.apiToken
      }

      if (body.domain) zone.domain = body.domain

      saveConfig(config)
      return { ...zone, apiToken: '***' }
    },
    {
      body: t.Object({
        apiToken: t.Optional(t.String()),
        domain: t.Optional(t.String()),
      }),
    }
  )
  .delete('/:id', ({ params, set }) => {
    const config = loadConfig()
    const idx = config.zones.findIndex(z => z.id === params.id)
    if (idx === -1) {
      set.status = 404
      return { error: 'Zone não encontrada' }
    }

    const zone = config.zones[idx]
    const inUse = config.tunnels.some(t =>
      t.hostnames.some(h => h.zoneId === zone.id)
    )
    if (inUse) {
      set.status = 400
      return { error: 'Zone está em uso por um ou mais hostnames' }
    }

    config.zones.splice(idx, 1)
    saveConfig(config)
    return { success: true }
  })
