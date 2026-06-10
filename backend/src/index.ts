import Elysia from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { resolve } from 'path'
import { authRoutes } from './routes/auth.routes'
import { setupRoutes } from './routes/setup.routes'
import { tunnelRoutes } from './routes/tunnel.routes'
import { hostnameRoutes } from './routes/hostname.routes'
import { zoneRoutes } from './routes/zone.routes'
import { wsRoutes } from './routes/ws.routes'
import { loadConfig } from './services/config.service'
import { startTunnel } from './services/cloudflared.service'

const PORT = parseInt(process.env.FLARED_PORT || '3000')

const isDev = process.env.NODE_ENV === 'development'
const frontendDist = resolve(import.meta.dir, '../../frontend/dist')
const indexHtml = resolve(frontendDist, 'index.html')

const app = new Elysia()
  .use(cors({
    origin: isDev ? '*' : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  .use(isDev ? new Elysia() : staticPlugin({ assets: frontendDist, prefix: '/' }))
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(setupRoutes)
  .use(tunnelRoutes)
  .use(hostnameRoutes)
  .use(zoneRoutes)
  .use(wsRoutes)
  .get('/*', () => isDev ? new Response('dev mode') : Bun.file(indexHtml))
  .listen(PORT)

console.log(`🚀 Flared backend rodando em http://localhost:${PORT}`)

// retoma tunnels ativos ao iniciar
const config = loadConfig()
const activeTunnels = config.tunnels.filter(t => t.active)
if (activeTunnels.length > 0) {
  console.log(`▶️  Retomando ${activeTunnels.length} tunnel(s) ativo(s)...`)
  activeTunnels.forEach(t => {
    try {
      startTunnel(t.tunnelId)
      console.log(`  ✓ ${t.name} (${t.tunnelId})`)
    } catch (err: any) {
      console.error(`  ✗ ${t.name}: ${err.message}`)
    }
  })
}

export type App = typeof app
