# ==============================================================================
# Stage 1: Builder (Compilação TypeScript e Geração do Prisma Client)
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifestos e configuração do Prisma para aproveitar cache de camadas
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Instala dependências completas (incluindo Nest CLI, TypeScript e Prisma CLI)
RUN npm ci

# Gera o Prisma Client (usa URL dummy apenas para satisfazer o schema/config em tempo de build)
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/plataforma_lei_db?schema=public"
RUN npx prisma generate

# Copia o restante do código-fonte e compila para ./dist
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/
RUN npm run build

# ==============================================================================
# Stage 2: Runner (Imagem de Produção Enxuta)
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copia apenas os artefatos necessários para execução e migrations
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./
COPY --chown=node:node docker-entrypoint.sh ./

RUN chmod +x ./docker-entrypoint.sh

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
