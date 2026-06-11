import Elysia, { t } from 'elysia'
import { randomUUID } from 'crypto'
import { authMiddleware } from '../middleware/auth.middleware'
import { loadConfig, saveConfig } from '../services/config.service'
import { listZones } from '../services/cloudflare.service'
import { getZonesForAccount, invalidateAccountCache } from '../services/zoneCache.service'

export const accountRoutes = new Elysia({ prefix: '/accounts' })
  .use(authMiddleware)
  .get('/', () => {
    const config = loadConfig()
    return config.accounts.map(a => ({ ...a, apiToken: '***' }))
  })
  .post(
    '/',
    async ({ body, set }) => {
      console.log(`[account] adicionando conta "${body.name}"...`)

      let zones: any[]
      try {
        zones = await listZones(body.apiToken)
      } catch (err: any) {
        set.status = 400
        return { error: `Token inválido ou sem permissão: ${err.message}` }
      }

      const config = loadConfig()
      const account = {
        id: randomUUID(),
        name: body.name.trim(),
        apiToken: body.apiToken.trim(),
      }

      config.accounts.push(account)
      saveConfig(config)
      console.log(`[account] conta "${account.name}" adicionada com ${zones.length} zone(s)`)

      return { ...account, apiToken: '***', zoneCount: zones.length }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        apiToken: t.String({ minLength: 1 }),
      }),
    }
  )
  .put(
    '/:accountId',
    async ({ params, body, set }) => {
      const config = loadConfig()
      const account = config.accounts.find(a => a.id === params.accountId)
      if (!account) {
        set.status = 404
        return { error: 'Conta não encontrada' }
      }

      if (body.name) account.name = body.name
      if (body.apiToken) {
        try {
          await listZones(body.apiToken)
        } catch (err: any) {
          set.status = 400
          return { error: `Token inválido: ${err.message}` }
        }
        account.apiToken = body.apiToken
        invalidateAccountCache(account.id)
      }

      saveConfig(config)
      console.log(`[account] conta "${account.name}" atualizada`)
      return { ...account, apiToken: '***' }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        apiToken: t.Optional(t.String()),
      }),
    }
  )
  .delete('/:accountId', ({ params, set }) => {
    const config = loadConfig()
    const idx = config.accounts.findIndex(a => a.id === params.accountId)
    if (idx === -1) {
      set.status = 404
      return { error: 'Conta não encontrada' }
    }

    const inUse = config.tunnels.some(t => t.accountId === params.accountId)
    if (inUse) {
      set.status = 400
      return { error: 'Conta em uso por um ou mais tunnels. Remova os tunnels primeiro.' }
    }

    const account = config.accounts[idx]
    invalidateAccountCache(params.accountId)
    config.accounts.splice(idx, 1)
    saveConfig(config)
    console.log(`[account] conta "${account.name}" removida`)
    return { success: true }
  })
  .get('/:accountId/zones', async ({ params, set }) => {
    const config = loadConfig()
    const account = config.accounts.find(a => a.id === params.accountId)
    if (!account) {
      set.status = 404
      return { error: 'Conta não encontrada' }
    }

    try {
      const zones = await getZonesForAccount(account)
      return zones
    } catch (err: any) {
      set.status = 502
      return { error: `Erro ao buscar zones: ${err.message}` }
    }
  })
