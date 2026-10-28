# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

# pg_dump for the backups: it must be the server's major version or newer
RUN (apk add --no-cache postgresql18-client || apk add --no-cache postgresql17-client) && \
    apk add --no-cache openssl su-exec && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && \
    mkdir -p /app/uploads/logos

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
