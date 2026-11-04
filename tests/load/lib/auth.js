// ROPG (Resource Owner Password Grant) でアクセストークンを取得する。
//
// 用途: k6 の setup() からテスト開始前に 1 回だけ呼び、全 VU で同じトークンを
// 共有する。VU ごとに取ると Keycloak のほうが先に音を上げ、API の計測に
// ならない。
//
// Keycloak の例:
//   IDP_TOKEN_URL=http://localhost:8080/realms/sandbox/protocol/openid-connect/token

import { check, fail } from 'k6';
import http from 'k6/http';

export function getRopgToken() {
  // AUTH_ENABLED=false のローカル環境では IdP を呼ばずダミートークンを返す
  if (__ENV.SKIP_AUTH === 'true') {
    return 'dummy-token-skip-auth';
  }

  const tokenUrl = __ENV.IDP_TOKEN_URL;
  const clientId = __ENV.IDP_CLIENT_ID;
  const clientSecret = __ENV.IDP_CLIENT_SECRET;
  const username = __ENV.IDP_USERNAME;
  const password = __ENV.IDP_PASSWORD;
  const scope = __ENV.IDP_SCOPE || '';
  const audience = __ENV.IDP_AUDIENCE || '';

  // 必須の環境変数が欠けていたら、計測に入る前に落とす。
  // 足りないまま走らせると全リクエストが 401 になった結果だけが残り、
  // 「API が壊れている」のか「トークンが取れていない」のか分からない。
  for (const [k, v] of Object.entries({
    IDP_TOKEN_URL: tokenUrl,
    IDP_CLIENT_ID: clientId,
    IDP_CLIENT_SECRET: clientSecret,
    IDP_USERNAME: username,
    IDP_PASSWORD: password,
  })) {
    if (!v) fail(`${k} is required for ROPG auth. See tests/load/.env.example`);
  }

  const payload = {
    grant_type: 'password',
    username,
    password,
    client_id: clientId,
    client_secret: clientSecret,
    ...(scope && { scope }),
    // Keycloak など標準 OIDC では不要。必要な IdP のときだけ含める
    ...(audience && { audience }),
  };

  const res = http.post(tokenUrl, payload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    tags: { name: 'idp_token' },
  });

  const ok = check(res, {
    'idp token status 200': (r) => r.status === 200,
    'idp token has access_token': (r) => !!r.json('access_token'),
  });
  if (!ok) {
    fail(`ROPG token request failed: status=${res.status} body=${res.body}`);
  }

  return res.json('access_token');
}
