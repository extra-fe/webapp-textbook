// 楽観ロック競合シナリオ: 同一リソースへの同時 PATCH で 409 Conflict が
// 正しく返ること、5xx やタイムアウトが発生しないことを検証する。
//
// 手順:
//   1. setup() で POST /api/races を 1 件作成し、id と version を全 VU に共有
//   2. 各 VU が同じ id・同じ version で PATCH /api/races/:id を送信
//   3. check() で 200 または 409 以外が返らないことを確認
//   4. teardown() で作成したレコードを削除
//
// 実行:
//   docker compose --profile load run --rm k6 run /scripts/scenarios/races-conflict.js

import { check, fail } from 'k6';
import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { getRopgToken } from '../lib/auth.js';
import { authHeaders, baseUrl } from '../lib/config.js';
import { buildEntry, runId } from '../lib/data.js';

// 409 は楽観ロック競合の期待レスポンスなので "failed" と見なさない
http.setResponseCallback(http.expectedStatuses(200, 201, 204, 409));

// 200 / 409 の内訳をサマリーに出すためのカスタムカウンター
const patchSuccess = new Counter('patch_success_200');
const patchConflict = new Counter('patch_conflict_409');

// p95 しきい値は環境変数で上書きできる。
//   ローカル（Docker 経由）: 既定 2000ms
//   ステージング: -e P95_THRESHOLD=1000
const p95Threshold = parseInt(__ENV.P95_THRESHOLD || '2000', 10);

export const options = {
  scenarios: {
    // shared-iterations: 全 VU が time=0 で同時スタートし iterations を奪い合う。
    // sleep なしで連続送信するため同一 version への同時 PATCH が発生し、
    // 楽観ロック競合（409）が確実に起きる。stages + sleep(1) では ramp-up に
    // より送信タイミングがずれ、競合が起きないことがある。
    conflict_burst: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 200,
      maxDuration: '35s',
    },
  },
  thresholds: {
    // 5xx はゼロ件（409 は expectedStatuses で除外済み）
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:PATCH /api/races/:id}': [`p(95)<${p95Threshold}`],
    // 200 または 409 以外が返ってはいけない
    'checks{check:409 or 200}': ['rate>=1.0'],
  },
};

export function setup() {
  const token = getRopgToken();
  const params = {
    ...authHeaders(token),
    tags: { name: 'setup POST /api/races' },
  };

  // name に乱数サフィックスを付け、前回の teardown が失敗していた場合の
  // @@unique([date, name, venue]) 衝突を防ぐ
  const suffix = Math.random().toString(36).slice(2, 8);
  const payload = JSON.stringify({
    date: new Date().toISOString(),
    name: `LOADTEST-${runId}-conflict-${suffix}`,
    venue: '京都',
    entries: [
      buildEntry(1, 1, 'ホクトベガ'),
      buildEntry(2, 2, 'サクラチヨノオー'),
      buildEntry(3, 3, 'メジロマックイーン'),
    ],
  });

  const res = http.post(`${baseUrl}/api/races`, payload, params);
  const ok = check(res, {
    'setup: race created (201 or 200)': (r) =>
      r.status === 201 || r.status === 200,
    'setup: response has id': (r) => !!r.json('id'),
    'setup: response has version': (r) => r.json('version') !== undefined,
  });
  if (!ok) {
    fail(`setup failed: status=${res.status} body=${res.body}`);
  }

  return { token, raceId: res.json('id'), version: res.json('version') };
}

export default function (data) {
  const params = {
    ...authHeaders(data.token),
    tags: { name: 'PATCH /api/races/:id' },
  };

  const payload = JSON.stringify({
    name: `LOADTEST-${runId}-conflict-updated`,
  });

  // version はクエリパラメータ。ボディに入れても効かない（2.2節の実装）。
  // 全 VU が同じ version を使うことで競合を確実に発生させる。
  const url = `${baseUrl}/api/races/${data.raceId}?version=${data.version}`;
  const res = http.patch(url, payload, params);

  check(res, { '409 or 200': (r) => r.status === 200 || r.status === 409 });

  if (res.status === 200) patchSuccess.add(1);
  if (res.status === 409) patchConflict.add(1);

  // 5xx は即 fail させてしきい値に反映する
  if (res.status >= 500) {
    fail(`unexpected server error: status=${res.status} body=${res.body}`);
  }
}

export function teardown(data) {
  const params = {
    ...authHeaders(data.token),
    tags: { name: 'teardown DELETE /api/races/:id' },
  };

  // 全リクエストが 409 で終わった場合もレコードは残るので、必ず削除を試みる
  const res = http.del(`${baseUrl}/api/races/${data.raceId}`, null, params);
  check(res, {
    'teardown: deleted (204 or 422)': (r) => r.status === 204 || r.status === 422,
  });
}
