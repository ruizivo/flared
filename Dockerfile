FROM debian:bookworm-slim

# instala dependências
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# instala bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# instala cloudflared
RUN curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# instala dependências do backend
COPY backend/package.json ./backend/
RUN cd backend && bun install

# build do frontend
COPY frontend/package.json frontend/bun.lockb* ./frontend/
RUN cd frontend && bun install

COPY frontend/ ./frontend/
RUN cd frontend && bun run build

# copia backend
COPY backend/ ./backend/

EXPOSE 3000

VOLUME ["/config"]

WORKDIR /app/backend
CMD ["bun", "run", "src/index.ts"]
