import Elysia from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { resolve } from 'path'
import { existsSync } from 'fs'
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

console.log(`[config] NODE_ENV=${process.env.NODE_ENV} PORT=${PORT}`)
console.log(`[config] frontendDist=${frontendDist} exists=${existsSync(frontendDist)}`)
console.log(`[config] indexHtml=${indexHtml} exists=${existsSync(indexHtml)}`)
console.log(`[config] FLARED_CONFIG_DIR=${process.env.FLARED_CONFIG_DIR || '/config'}`)
console.log(`[config] FLARED_HOST_GATEWAY=${process.env.FLARED_HOST_GATEWAY || '(não definido)'}`)

const app = new Elysia()
  .use(cors({
    origin: isDev ? '*' : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  .use(isDev ? new Elysia() : staticPlugin({ assets: frontendDist, prefix: '/' }))
  .onRequest(({ request }) => {
    const { method, url } = request
    const path = new URL(url).pathname
    // não loga polling de logs para não poluir
    if (!path.includes('/logs')) {
      console.log(`→ ${method} ${path}`)
    }
  })
  .onAfterHandle(({ request, set }) => {
    const path = new URL(request.url).pathname
    if (!path.includes('/logs')) {
      const status = typeof set.status === 'number' ? set.status : 200
      console.log(`← ${request.method} ${path} ${status}`)
    }
  })
  .onError(({ error, request, code }) => {
    const path = request ? new URL(request.url).pathname : 'unknown'
    console.error(`✗ ${code} ${path} — ${(error as Error).message}`)
  })
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .use(authRoutes)
  .use(setupRoutes)
  .use(tunnelRoutes)
  .use(hostnameRoutes)
  .use(zoneRoutes)
  .use(wsRoutes)
  .get('/*', ({ request }) => {
    if (isDev) return new Response('dev mode')
    // arquivos com extensão são assets — deixa o staticPlugin resolver (ou 404)
    if (/\.[a-zA-Z0-9]+$/.test(new URL(request.url).pathname)) {
      return new Response('Not Found', { status: 404 })
    }
    return Bun.file(indexHtml)
  })
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
} else {
  console.log(`[config] nenhum tunnel ativo para retomar`)
}

export type App = typeof app
