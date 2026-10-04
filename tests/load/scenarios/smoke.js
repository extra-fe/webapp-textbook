// 疎通確認 (smoke test): 認証不要の 2 エンドポイントを 1 VU で 30 秒間叩く。
//   - GET /api/health              … API 単体のヘルス（1.7節）
//   - GET /api/guest/announcements … 認証なしで読める一覧（3.7節）
// 本格的なシナリオを回す前に、これで BASE_URL が届くことを確かめる。
//
// 実行: docker compose --profile load run --rm k6 run /scripts/scenarios/smoke.js

import { check, sleep } from 'k6';
import http from 'k6/http';
import { baseUrl } from '../lib/config.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function () {
  const healthRes = http.get(`${baseUrl}/api/health`, {
    tags: { name: 'GET /api/health' },
  });
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health body.status == ok': (r) => r.json('status') === 'ok',
  });

  // /api/connect-test ではなく announcements を叩く。connect-test は
  // @StrictThrottle()（4.5節）なので、1 VU × 30 秒だと 429 が混ざる。
  const annRes = http.get(`${baseUrl}/api/guest/announcements`, {
    tags: { name: 'GET /api/guest/announcements' },
  });
  check(annRes, {
    'announcements status 200': (r) => r.status === 200,
    'announcements body is array': (r) => Array.isArray(r.json()),
  });

  sleep(1);
}
