# syntax=docker/dockerfile:1
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.7.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json nexacloud.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/app/package.json ./apps/app/

RUN pnpm install --no-frozen-lockfile

COPY . .

ARG NC_ENV_HASH
RUN --mount=type=secret,id=ncenv sh -c 'set -a; [ -f /run/secrets/ncenv ] && . /run/secrets/ncenv; set +a; pnpm --filter @naidioma/api db:generate && pnpm build'

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV SERVE_WEB_DIST=true

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @naidioma/api db:push && pnpm start"]
