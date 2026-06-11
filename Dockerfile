# Stage 1: build
FROM oven/bun:1 AS builder

WORKDIR /app

# instala dependências do backend
COPY backend/package.json ./backend/
RUN cd backend && bun install --frozen-lockfile

# instala dependências e faz build do frontend
COPY frontend/package.json frontend/bun.lock* ./frontend/
RUN cd frontend && bun install

COPY frontend/ ./frontend/
RUN cd frontend && bun run build

# copia backend
COPY backend/ ./backend/

# Stage 2: runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# copia bun do builder
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

# instala cloudflared
ADD https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 /usr/local/bin/cloudflared
RUN chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# copia apenas o necessário para rodar
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

VOLUME ["/config"]

WORKDIR /app/backend
CMD ["bun", "run", "src/index.ts"]
