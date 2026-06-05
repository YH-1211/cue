# ============================================================
# Cue 本番用 Dockerfile（Next.js 16 standalone）
# 使い方: このファイルをプロジェクトルート（package.json と同じ場所）にコピー。
# 事前に next.config.ts へ output: "standalone" を追加しておくこと（移行手順 3-A-1）。
# ============================================================

# ---- 1) 依存インストール ----
FROM node:24-slim AS deps
WORKDIR /app
# sharp（画像最適化）に必要なライブラリ
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2) ビルド ----
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .env.local はイメージに焼かない。実行時に渡す（docker-compose の env_file）。
# ただし NEXT_PUBLIC_* はビルド時にコードへ埋め込まれるため、build args で受け取る。
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 3) 実行（軽量 standalone） ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# 非rootユーザーで動かす
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

# standalone 出力 + 静的ファイル + public をコピー
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
# standalone は server.js を直接起動する
CMD ["node", "server.js"]
