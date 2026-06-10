import Elysia, { t } from 'elysia'
import { existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import { authMiddleware } from '../middleware/auth.middleware'
import {
  runCloudflaredLogin,
  createTunnelCli,
  getCloudflaredVersion,
} from '../services/cloudflared.service'
import {
  getAccountId,
  listCloudflareTunnels,
} from '../services/cloudflare.service'
import {
  hasCert,
  getCertPath,
  loadConfig,
  saveConfig,
  ensureTunnelDir,
  getCredentialsPath,
  hasCredentials,
} from '../services/config.service'
import { writeConfigYml } from '../services/configYml.service'
import { randomUUID } from 'crypto'

export const setupRoutes = new Elysia({ prefix: '/setup' })
  .use(authMiddleware)
  .get('/status', () => {
    const config = loadConfig()
    return {
      hasCert: hasCert(),
      hasTunnels: config.tunnels.length > 0,
      certPath: getCertPath(),
    }
  })
  .post('/login', async ({ set }) => {
    if (hasCert()) {
      return { alreadyLoggedIn: true, certPath: getCertPath() }
    }
    try {
      const { url } = await runCloudflaredLogin()
      return { url }
    } catch (err: any) {
      set.status = 500
      return { error: err.message }
    }
  })
  .get('/login/status', () => {
    return { done: hasCert() }
  })
  .post(
    '/tunnel',
    async ({ body, set }) => {
      if (!hasCert()) {
        set.status = 400
        return { error: 'Faça login no Cloudflare primeiro' }
      }

      try {
        const tunnelId = await createTunnelCli(body.name)
        ensureTunnelDir(tunnelId)

        const credPath = getCredentialsPath(tunnelId)

        if (!existsSync(credPath)) {
          // cloudflared pode escrever em ~/.cloudflared/ ou no mesmo dir do cert (CONFIG_DIR)
          const home = process.env.HOME || '/root'
          const candidates = [
            join(home, '.cloudflared', `${tunnelId}.json`),
            join(process.env.FLARED_CONFIG_DIR || '/config', `${tunnelId}.json`),
          ]
          const found = candidates.find(p => existsSync(p))
          if (found) {
            copyFileSync(found, credPath)
          } else {
            set.status = 500
            return { error: 'Arquivo de credenciais não encontrado após criação' }
          }
        }

        const config = loadConfig()
        const newTunnel = {
          id: randomUUID(),
          tunnelId,
          name: body.name,
          active: false,
          credentialsFile: credPath,
          hostnames: [],
        }

        config.tunnels.push(newTunnel)
        saveConfig(config)
        writeConfigYml(newTunnel)

        return { tunnel: newTunnel }
      } catch (err: any) {
        set.status = 500
        return { error: err.message }
      }
    },
    {
      body: t.Object({ name: t.String({ minLength: 1 }) }),
    }
  )
  .get('/version', async () => {
    const version = await getCloudflaredVersion()
    return { version }
  })
  .get('/tunnels/cloudflare', async ({ set }) => {
    const config = loadConfig()
    if (config.zones.length === 0) {
      set.status = 400
      return { error: 'Nenhuma zone cadastrada. Adicione uma zone primeiro.' }
    }

    const zone = config.zones[0]
    try {
      const accountId = await getAccountId(zone.apiToken, zone.zoneId)
      const cfTunnels = await listCloudflareTunnels(zone.apiToken, accountId)

      const alreadyImported = new Set(config.tunnels.map(t => t.tunnelId))

      return cfTunnels.map(t => ({
        tunnelId: t.id,
        name: t.name,
        status: t.status,
        createdAt: t.created_at,
        imported: alreadyImported.has(t.id),
        hasCredentials: hasCredentials(t.id),
      }))
    } catch (err: any) {
      if (err.message === 'Authentication error') {
        set.status = 403
        return { error: 'O token API não tem permissão para listar tunnels. Edite o token no painel Cloudflare e adicione a permissão "Cloudflare Tunnel:Read" (nível de conta).' }
      }
      set.status = 500
      return { error: err.message }
    }
  })
  .post(
    '/tunnel/import',
    async ({ body, set }) => {
      const config = loadConfig()

      const already = config.tunnels.find(t => t.tunnelId === body.tunnelId)
      if (already) {
        set.status = 400
        return { error: 'Tunnel já importado' }
      }

      ensureTunnelDir(body.tunnelId)
      const credPath = getCredentialsPath(body.tunnelId)

      if (!existsSync(credPath)) {
        const home = process.env.HOME || '/root'
        const candidates = [
          join(home, '.cloudflared', `${body.tunnelId}.json`),
          join(process.env.FLARED_CONFIG_DIR || '/config', `${body.tunnelId}.json`),
        ]
        const found = candidates.find(p => existsSync(p))
        if (found) {
          copyFileSync(found, credPath)
        } else {
          set.status = 400
          return {
            error: 'Arquivo de credenciais não encontrado. Execute "cloudflared tunnel create" ou faça login primeiro.',
          }
        }
      }

      const newTunnel = {
        id: randomUUID(),
        tunnelId: body.tunnelId,
        name: body.name,
        active: false,
        credentialsFile: credPath,
        hostnames: [],
      }

      config.tunnels.push(newTunnel)
      saveConfig(config)
      writeConfigYml(newTunnel)

      return { tunnel: newTunnel }
    },
    {
      body: t.Object({
        tunnelId: t.String(),
        name: t.String(),
      }),
    }
  )
