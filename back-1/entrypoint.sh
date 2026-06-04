#!/bin/sh
set -e

mkdir -p /app/uploads/logos
chown -R appuser:appgroup /app/uploads

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec su-exec appuser node dist/src/main
