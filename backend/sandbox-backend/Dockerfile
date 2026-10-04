########## Build Stage ##########
# ビルドコンテキストはリポジトリルート（shared/ を参照するため）
#   docker build -t sandbox-backend -f backend/sandbox-backend/Dockerfile .
FROM public.ecr.aws/docker/library/node:24.19.0-bookworm-slim AS builder

# 公式 node イメージに pnpm は同梱されていない。package.json の
# packageManager を見てくれるので、バージョンは二重に書かない。
RUN corepack enable

# tsconfig の rootDir が ../.. なので、リポジトリ構造を反映した WORKDIR にする
WORKDIR /workspace/backend/sandbox-backend

# 依存の確定に必要なものだけ先にコピーする（レイヤーキャッシュを効かせる）。
# pnpm-workspace.yaml が無いと 1.5節の allowBuilds が効かず、pnpm 10 以降は
# prisma / @prisma/engines の postinstall をブロックする。
COPY backend/sandbox-backend/package.json \
     backend/sandbox-backend/pnpm-lock.yaml \
     backend/sandbox-backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY backend/sandbox-backend/ .
COPY shared/ /workspace/shared/

# prisma generate は datasource の解決に DATABASE_URL を要求する（接続はしない）
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# prisma-client generator は src/generated/prisma に TypeScript を出力するので、
# 必ず pnpm build より前に実行する（build がこの出力を dist へコンパイルする）
RUN npx prisma generate
RUN pnpm build

# 本番依存だけを入れ直す
RUN pnpm install --prod --frozen-lockfile

# Prisma 7 の @prisma/client は CLI を peer dependency に持つため、--prod だけでは
# 実行時に使わない CLI / Studio / pglite / TypeScript が残る（8.3節）。
# パス名にバージョンが入るので、Prisma を上げたらこのリストと動作を再確認すること。
RUN rm -rf node_modules/prisma \
           node_modules/.pnpm/prisma@* \
           node_modules/.pnpm/@prisma+studio-core@* \
           node_modules/.pnpm/@prisma+dev@* \
           node_modules/.pnpm/@electric-sql+pglite* \
           node_modules/.pnpm/effect@* \
           node_modules/.pnpm/typescript@*


########## Runtime Stage ##########
FROM public.ecr.aws/docker/library/node:24.19.0-alpine

# Prisma が実行時に必要とする。あわせて実行時に不要な npm を消して攻撃面を縮める
RUN apk add --no-cache openssl ca-certificates \
    && rm -rf /usr/local/lib/node_modules/npm \
              /usr/local/bin/npm \
              /usr/local/bin/npx

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /workspace/backend/sandbox-backend
ENV NODE_ENV=production

# 所有者は COPY --chown で付ける。RUN chown -R は全ファイルのメタデータを
# 書き換えるため、同じ量のレイヤーがもう1層積まれる（8.3節）
COPY --chown=appuser:appgroup --from=builder \
     /workspace/backend/sandbox-backend/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=builder \
     /workspace/backend/sandbox-backend/dist ./dist

USER appuser
EXPOSE 3000
# shared/ を含むため dist/main.js ではなくこのパスになる（2.2節）。
# --require で OTel の初期化を本体より先に読み込む（4.1節）
CMD ["node", "--require", "./dist/backend/sandbox-backend/src/otel/instrumentation", \
     "dist/backend/sandbox-backend/src/main"]
