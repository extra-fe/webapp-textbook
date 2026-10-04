// 負荷テスト共通の設定。各シナリオから import して使う。

export const baseUrl = __ENV.BASE_URL;
if (!baseUrl) {
  throw new Error(
    'BASE_URL is required. 例: BASE_URL=http://localhost:3000 k6 run ...',
  );
}

// 本番ガード: URL に "prod" を含む場合は ALLOW_PROD=true がなければ実行を拒否
if (/prod/i.test(baseUrl) && __ENV.ALLOW_PROD !== 'true') {
  throw new Error(
    `BASE_URL "${baseUrl}" は production と推測されます。意図的な場合は ALLOW_PROD=true を付けて再実行してください。`,
  );
}

// 既定のしきい値。シナリオ側で上書きできる。
// しきい値を割ると k6 は exit 99 で終わるので、CI の判定にそのまま使える。
export const defaultThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<500'],
};

export function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}
