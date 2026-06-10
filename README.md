# flared

Interface web para gerenciar Cloudflare Tunnels — crie tunnels, gerencie hostnames, controle DNS e monitore conexões, tudo em um único container Docker.

## Funcionalidades

- 🔐 Login seguro com senha via variável de ambiente
- ☁️ Setup guiado do Cloudflare Tunnel (login + criação)
- 🚇 Múltiplos tunnels por instância
- 🌐 Múltiplos domínios/zones Cloudflare
- ➕ Adicionar/remover hostnames com criação automática de CNAME no DNS
- 🔁 Ativar/desativar hostname (adiciona/remove CNAME automaticamente)
- ⚙️ Configurações por hostname: `noTLSVerify`, `httpHostHeader`, `service`
- 📋 Logs em tempo real via WebSocket
- 🔄 Atualização do cloudflared pela interface
- 📦 Container único com cloudflared embutido

## Uso rápido

```bash
docker run -d \
  --name flared \
  -p 3000:3000 \
  -v ./config:/config \
  -e FLARED_PASSWORD=suasenha \
  -e FLARED_JWT_SECRET=segredo-aleatorio \
  ghcr.io/SEU_USER/flared:latest
```

Ou com docker-compose:

```yaml
services:
  flared:
    image: ghcr.io/SEU_USER/flared:latest
    container_name: flared
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
    environment:
      - FLARED_PASSWORD=suasenha
      - FLARED_JWT_SECRET=segredo-aleatorio
      - FLARED_JWT_EXPIRY=24h
```

## Variáveis de ambiente

| Variável | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `FLARED_PASSWORD` | ✅ | — | Senha de acesso à interface |
| `FLARED_JWT_SECRET` | ✅ | — | Segredo para assinar tokens JWT |
| `FLARED_JWT_EXPIRY` | ❌ | `24h` | Expiração do token |
| `FLARED_PORT` | ❌ | `3000` | Porta do servidor |
| `FLARED_CONFIG_DIR` | ❌ | `/config` | Diretório de configurações |

## API

O backend expõe uma API REST completa em `/api`:

- `POST /auth/login` — autenticação
- `GET /setup/status` — status do setup
- `POST /setup/login` — iniciar login Cloudflare
- `POST /setup/tunnel` — criar tunnel
- `GET /tunnels` — listar tunnels
- `POST /tunnels/:id/start` — iniciar tunnel
- `POST /tunnels/:id/stop` — parar tunnel
- `GET /tunnels/:id/logs` — logs do tunnel
- `GET /tunnels/:tunnelId/hostnames` — listar hostnames
- `POST /tunnels/:tunnelId/hostnames` — adicionar hostname
- `POST /tunnels/:tunnelId/hostnames/:id/toggle` — ativar/desativar
- `DELETE /tunnels/:tunnelId/hostnames/:id` — remover hostname
- `GET /zones` — listar zones
- `POST /zones` — adicionar zone
- `DELETE /zones/:id` — remover zone
- `WS /ws/tunnels/:tunnelId/logs` — logs em tempo real

## Desenvolvimento

```bash
# backend
cd backend && bun dev

# frontend
cd frontend && bun dev
```

## Licença

MIT
