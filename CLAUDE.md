# flared — Cloudflare Tunnel Manager

Interface web para gerenciar Cloudflare Tunnels. Container único com cloudflared embutido, backend Bun/Elysia e frontend React.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Bun |
| Backend | Elysia (TypeScript) |
| Frontend | React + Vite + Tailwind CSS |
| Autenticação | JWT via `@elysiajs/jwt` |
| HTTP Client | Axios |
| Estado servidor | TanStack Query |
| Roteamento | React Router v6 |
| Ícones | Lucide React |
| Container | Debian Bookworm Slim + cloudflared |

---

## Estrutura do projeto

```
flared/
  backend/
    src/
      index.ts                        # entry point, retoma tunnels ativos ao iniciar
      types/index.ts                  # interfaces TypeScript compartilhadas
      middleware/
        auth.middleware.ts            # validação JWT via header Authorization
      services/
        config.service.ts             # lê/salva /config/app-config.json
        configYml.service.ts          # gera config.yml do cloudflared por tunnel
        cloudflared.service.ts        # spawn/stop/logs dos processos cloudflared
        cloudflare.service.ts         # API Cloudflare (validar token, CNAME DNS)
      routes/
        auth.routes.ts                # POST /auth/login, POST /auth/verify
        setup.routes.ts               # GET /setup/status, POST /setup/login, POST /setup/tunnel
        tunnel.routes.ts              # CRUD tunnels + start/stop/restart/logs
        hostname.routes.ts            # CRUD hostnames + toggle ativo/inativo
        zone.routes.ts                # CRUD zones (domínios Cloudflare)
        ws.routes.ts                  # WS /ws/tunnels/:id/logs
  frontend/
    src/
      main.tsx
      App.tsx                         # rotas React Router
      types/index.ts                  # interfaces TypeScript
      contexts/
        AuthContext.tsx               # estado de autenticação, JWT no localStorage
      services/
        api.ts                        # instância axios + todos os métodos de API
      components/
        ui.tsx                        # Button, Input, Toggle, Badge, Modal, EmptyState, Spinner
        Layout.tsx                    # sidebar + Outlet
        ProtectedRoute.tsx            # redirect para /login se não autenticado
        LogsModal.tsx                 # WebSocket logs em tempo real
        HostnameForm.tsx              # formulário adicionar hostname
      pages/
        LoginPage.tsx                 # /login
        SetupPage.tsx                 # /setup — wizard com polling para cert.pem
        DashboardPage.tsx             # /dashboard
        TunnelsPage.tsx               # /tunnels — gestão completa
        ZonesPage.tsx                 # /zones
        SettingsPage.tsx              # /settings — versão e update do cloudflared
  Dockerfile
  docker-compose.yml
  .env.example
  README.md
```

---

## Variáveis de ambiente

```env
FLARED_PASSWORD=       # obrigatório — senha de acesso à interface
FLARED_JWT_SECRET=     # obrigatório — segredo para assinar JWT
FLARED_JWT_EXPIRY=24h  # opcional — expiração do token
FLARED_PORT=3000       # opcional — porta do servidor
FLARED_CONFIG_DIR=/config  # opcional — diretório de configurações
```

---

## Persistência de dados

Tudo salvo em `FLARED_CONFIG_DIR` (padrão `/config`):

```
/config
  cert.pem                          # credencial de login Cloudflare
  app-config.json                   # zones e tunnels (estado da aplicação)
  tunnels/
    {TUNNEL_ID}/
      {TUNNEL_ID}.json              # credenciais do tunnel (gerado pelo cloudflared)
      config.yml                    # configuração gerada automaticamente
```

### Estrutura do app-config.json

```json
{
  "zones": [
    {
      "id": "uuid",
      "zoneId": "cloudflare-zone-id",
      "domain": "seudominio.com",
      "apiToken": "cf-api-token"
    }
  ],
  "tunnels": [
    {
      "id": "uuid",
      "tunnelId": "cloudflare-tunnel-uuid",
      "name": "homelab-tunnel",
      "active": true,
      "credentialsFile": "/config/tunnels/{id}/{id}.json",
      "hostnames": [
        {
          "id": "uuid",
          "hostname": "n8n.seudominio.com",
          "service": "https://localhost:443",
          "noTLSVerify": true,
          "httpHostHeader": "n8n.seudominio.com",
          "active": true,
          "zoneId": "uuid-da-zone"
        }
      ]
    }
  ]
}
```

---

## API endpoints

### Auth
```
POST /auth/login          body: { password }  → { token }
POST /auth/verify         header: Authorization: Bearer <token>
```

### Setup
```
GET  /setup/status        → { hasCert, hasTunnels }
POST /setup/login         → { url } ou { alreadyLoggedIn: true }
GET  /setup/login/status  → { done: bool }  (polling para detectar cert.pem)
POST /setup/tunnel        body: { name }  → Tunnel
GET  /setup/version       → { version }
```

### Tunnels
```
GET    /tunnels              → Tunnel[]
GET    /tunnels/:id          → Tunnel
DELETE /tunnels/:id
POST   /tunnels/:id/start
POST   /tunnels/:id/stop
POST   /tunnels/:id/restart
GET    /tunnels/:id/logs     → { logs: string[] }
GET    /tunnels/system/version
POST   /tunnels/system/update
```

### Hostnames
```
GET    /tunnels/:tunnelId/hostnames
POST   /tunnels/:tunnelId/hostnames        body: { hostname, service, noTLSVerify, httpHostHeader }
PATCH  /tunnels/:tunnelId/hostnames/:id    body: { service?, noTLSVerify?, httpHostHeader?, active? }
POST   /tunnels/:tunnelId/hostnames/:id/toggle
DELETE /tunnels/:tunnelId/hostnames/:id
```

### Zones
```
GET    /zones
POST   /zones              body: { zoneId, apiToken, domain? }
PUT    /zones/:id          body: { apiToken?, domain? }
DELETE /zones/:id
```

### WebSocket
```
WS /ws/tunnels/:tunnelId/logs   → { log: string }
```

---

## Comportamentos importantes

**Ao adicionar hostname:**
1. Verifica se existe uma zone cadastrada que cobre o domínio
2. Cria CNAME no DNS do Cloudflare (`hostname → tunnelId.cfargotunnel.com`, proxied)
3. Adiciona ao `app-config.json`
4. Regenera o `config.yml` do tunnel
5. Reinicia o processo cloudflared se estiver rodando

**Ao fazer toggle de hostname (ativar/desativar):**
- Ativo → Inativo: deleta o CNAME do DNS + remove do config.yml + restart
- Inativo → Ativo: recria o CNAME + adiciona ao config.yml + restart

**Ao deletar hostname:**
- Tenta deletar o CNAME (erro silencioso se não existir)
- Remove do config, regenera yml, reinicia cloudflared

**Ao iniciar a aplicação:**
- Carrega `app-config.json`
- Retoma automaticamente todos os tunnels com `active: true`

**Setup wizard (SetupPage):**
- Faz polling a cada 2s em `GET /setup/login/status` para detectar criação do `cert.pem`
- O processo `cloudflared tunnel login` fica rodando em background até o usuário autorizar no browser

---

## Desenvolvimento local

```bash
# Backend
cd backend
bun install
bun dev          # roda em localhost:3000 com hot reload

# Frontend (outro terminal)
cd frontend
bun install
bun dev          # roda em localhost:5173 com proxy para :3000
```

O `vite.config.ts` já configura proxy para `/auth`, `/setup`, `/tunnels`, `/zones` e `/ws`.

---

## Build e Docker

```bash
# Build da imagem
docker build -t flared .

# Rodar
docker compose up -d

# Logs
docker logs flared -f
```

O Dockerfile:
1. Instala Bun e cloudflared no Debian Bookworm
2. Instala dependências do backend e frontend
3. Faz build do frontend (`bun run build` → `frontend/dist`)
4. O backend serve os arquivos estáticos do frontend em produção via `@elysiajs/static`

---

## Convenções de código

- Todos os IDs internos são UUIDs gerados com `crypto.randomUUID()`
- IDs do Cloudflare (tunnelId, zoneId) são os UUIDs originais da API Cloudflare
- Erros retornam `{ error: string }` com status HTTP adequado
- O token API do Cloudflare nunca é retornado pela API (mascarado como `***`)
- Logs do cloudflared são mantidos em memória (últimos 500 linhas por tunnel)
- O `config.yml` é sempre regenerado do zero a partir do estado em memória — nunca editado parcialmente

---

## Pontos de atenção para futuras modificações

- **Adicionar nova rota:** criar em `backend/src/routes/`, registrar em `index.ts`, adicionar método em `frontend/src/services/api.ts`
- **Novo campo em Hostname/Tunnel:** atualizar `types/index.ts` em ambos backend e frontend, atualizar `configYml.service.ts` se afetar o yml, atualizar `HostnameForm.tsx`
- **O cloudflared não faz hot reload do config.yml** — sempre usar `restartTunnel()` após modificar
- **WebSocket usa o `id` interno** (UUID do app-config), não o `tunnelId` do Cloudflare
- **Múltiplos tunnels** rodam como processos separados no mesmo container, gerenciados pelo `Map<string, TunnelProcess>` em `cloudflared.service.ts`
