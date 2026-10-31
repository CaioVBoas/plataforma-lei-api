#!/bin/sh
set -e

echo "⏳ Aplicando migrations pendentes do Prisma..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Executando seed inicial do banco de dados..."
  node dist/prisma/seed.js
fi

echo "🚀 Iniciando servidor NestJS..."
exec "$@"
