# syntax=docker/dockerfile:1

# ---- builder ------------------------------------------------------------
# Vite で UI を 1 ファイル HTML に固めるため、devDependencies も全部入れる
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY server.ts ./

RUN npm run build

# ---- runtime ------------------------------------------------------------
# tsx を runtime でも使うので devDependencies をそのまま持ち越す
# (scripts/start = "tsx server.ts" のため)
FROM node:20-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV MCP_HOST=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3001

CMD ["npm", "start"]
