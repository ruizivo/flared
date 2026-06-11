import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function getBackendPort(): number {
  try {
    const env = readFileSync(resolve(__dirname, '../.env'), 'utf-8')
    const match = env.match(/^FLARED_PORT=(\d+)/m)
    if (match) return parseInt(match[1])
  } catch {}
  return 3001
}

const backendPort = getBackendPort()
const backendHttp = `http://localhost:${backendPort}`
const backendWs = `ws://localhost:${backendPort}`

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backendHttp,
      '/ws': {
        target: backendWs,
        ws: true,
      },
    },
  },
})
