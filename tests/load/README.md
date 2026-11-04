# 負荷テスト（k6）

本書 7.7節の負荷テスト基盤です。k6 はホストに入れず、`docker-compose.yml` の
`load` プロファイルから実行します。

## 構成

```
tests/load/
├── lib/
│   ├── config.js   BASE_URL の解決・本番ガード・共通しきい値
│   ├── auth.js     ROPG でのトークン取得（SKIP_AUTH=true でスキップ）
│   └── data.js     POST /api/races 用のテストデータ
└── scenarios/
    ├── smoke.js            疎通確認（1 VU / 30秒）
    └── races-conflict.js   楽観ロック競合（20 VU / 200 iterations）
```

シナリオを足すときは `scenarios/` にファイルを 1 つ増やします。`lib/` は
そのまま使い回せます。

## 事前準備

バックエンドを**レート制限を緩めて**起動します。4.4節のスロットリングは既定が
1分100リクエストなので、そのままでは競合シナリオの後半が全部 429 になります。

```bash
docker compose up -d postgres

cd backend/sandbox-backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run db:seed
pnpm run build
```

```bash
# bash
AUTH_ENABLED=false THROTTLE_DEFAULT_LIMIT=100000 THROTTLE_STRICT_LIMIT=100000 \
  node dist/backend/sandbox-backend/src/main.js
```

```powershell
# PowerShell
$env:AUTH_ENABLED="false"; $env:THROTTLE_DEFAULT_LIMIT="100000"; $env:THROTTLE_STRICT_LIMIT="100000"
node dist/backend/sandbox-backend/src/main.js
```

## 実行

```bash
docker compose --profile load run --rm k6 run /scripts/scenarios/smoke.js
docker compose --profile load run --rm k6 run /scripts/scenarios/races-conflict.js
```

ステージングに向けるときは環境変数で上書きします。

```bash
BASE_URL=https://stg.example.com SKIP_AUTH=false \
  docker compose --profile load run --rm k6 run /scripts/scenarios/races-conflict.js
```

## 後片付けの確認

`teardown()` が作成レコードを削除します。残っていないことを確認します。

```bash
docker exec pg-local psql -U postgres -d mydb \
  -c "SELECT count(*) FROM races WHERE name LIKE 'LOADTEST-%';"
```
