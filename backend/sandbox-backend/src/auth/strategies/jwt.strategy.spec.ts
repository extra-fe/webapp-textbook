// passport-jwt の Strategy をモックして、super() に渡ったオプションを取り出す。
const mockStrategyConstructor = jest.fn();

jest.mock('passport-jwt', () => ({
  ExtractJwt: { fromAuthHeaderAsBearerToken: jest.fn(() => jest.fn()) },
  Strategy: class {
    // PassportStrategy の mixin がコンストラクタ内で passport.use(this) を
    // 呼ぶため、name が無いと「Authentication strategies must have a name」で落ちる
    name = 'jwt';
    authenticate() {}
    constructor(opts: Record<string, unknown>) {
      mockStrategyConstructor(opts);
    }
  },
}));

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => jest.fn()),
}));

import { ForbiddenException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { passportJwtSecret } from 'jwks-rsa';
import type { IIdpProvider } from '../idp/idp-provider.interface';
import { JwtStrategy } from './jwt.strategy';

const mockIdp: IIdpProvider = {
  getJwksUri: () =>
    'http://localhost:8080/realms/sandbox/protocol/openid-connect/certs',
  getIssuer: () => 'http://localhost:8080/realms/sandbox',
  getAudience: () => 'sandbox-api',
  mapClaims: (payload) => ({
    sub: payload['sub'] as string,
    email: payload['email'] as string,
    name: payload['name'] as string,
  }),
};

describe('JwtStrategy の検証設定', () => {
  beforeEach(() => {
    mockStrategyConstructor.mockClear();
  });

  /** super() に渡ったオプションオブジェクトを取り出す */
  const captureConstructorOpts = (): Record<string, unknown> => {
    // TestingModule を通さず直接 new する。validate() を呼ばないので
    // PrismaService も Cache も空オブジェクトで足りる。
    new JwtStrategy(mockIdp, {} as never, {} as never);
    const [opts] = mockStrategyConstructor.mock.calls[0] as [
      Record<string, unknown>,
    ];
    return opts;
  };

  // 既定値と同じ false だが、明示しておかないと「誤って true を足す」変更を
  // レビューでもテストでも検出できない。
  it('should set ignoreExpiration to false (exp claim is validated)', () => {
    expect(captureConstructorOpts().ignoreExpiration).toBe(false);
  });

  it('should restrict to RS256 algorithm', () => {
    expect(captureConstructorOpts().algorithms).toEqual(['RS256']);
  });

  it('should verify issuer and audience', () => {
    const opts = captureConstructorOpts();
    expect(opts.issuer).toBe('http://localhost:8080/realms/sandbox');
    expect(opts.audience).toBe('sandbox-api');
  });
});

describe('JwtStrategy の JWKS 設定', () => {
  beforeEach(() => {
    (passportJwtSecret as jest.Mock).mockClear();
  });

  /** passportJwtSecret() に渡ったオプションオブジェクトを取り出す */
  const captureJwksOpts = (): Record<string, unknown> => {
    new JwtStrategy(mockIdp, {} as never, {} as never);
    const [opts] = (passportJwtSecret as jest.Mock).mock.calls[0] as [
      Record<string, unknown>,
    ];
    return opts;
  };

  // 外すと毎リクエストで JWKS を取りに行き、IdP のレート制限に抵触する
  it('should enable the kid-based LRU cache', () => {
    expect(captureJwksOpts().cache).toBe(true);
  });

  // 長すぎると緊急ローテーション時に古い鍵を掴み続ける
  it('should keep cached keys for 10 minutes', () => {
    expect(captureJwksOpts().cacheMaxAge).toBe(10 * 60 * 1000);
  });

  it('should enable rate limiting of JWKS requests', () => {
    expect(captureJwksOpts().rateLimit).toBe(true);
  });

  it('should set jwksRequestsPerMinute explicitly', () => {
    expect(captureJwksOpts().jwksRequestsPerMinute).toBe(10);
  });

  // ハードコードした URL ではなく IdP プロバイダー越しに取る（1.6節）
  it('should take jwksUri from IIdpProvider', () => {
    expect(captureJwksOpts().jwksUri).toBe(mockIdp.getJwksUri());
  });
});

describe('JwtStrategy のシングルフライト', () => {
  const payload = { sub: 'keycloak-sub-1', email: 'a@example.com', name: 'A' };

  /** validate() を動かすので Prisma と Cache のモックを渡して組み立てる */
  const build = () => {
    const mockPrisma = { user: { findUnique: jest.fn() } };
    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
    };
    const strategy = new JwtStrategy(
      mockIdp,
      mockPrisma as never,
      mockCache as unknown as Cache,
    );
    return { strategy, mockPrisma, mockCache };
  };

  it('50 並列のキャッシュミスでも DB クエリは 1 回に畳まれる', async () => {
    const { strategy, mockPrisma } = build();
    let resolveDb: ((v: unknown) => void) | undefined;
    mockPrisma.user.findUnique.mockReturnValue(
      new Promise((resolve) => {
        resolveDb = resolve;
      }),
    );

    const first = strategy.validate(payload);
    // 代表が inflight.set() に到達するのを待つ
    await Promise.resolve();
    const rest = Array.from({ length: 49 }, () => strategy.validate(payload));
    resolveDb!({ id: 'uuid-1', roles: [{ role: 'viewer' }] });
    await Promise.all([first, ...rest]);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  // 「3回とも ForbiddenException が出る」だけでは finally の有無を区別できない。
  // 失敗のあとに DB が復旧したら引き直せるか、まで見る。
  it('DB 取得が失敗しても inflight が掃除され、次の取得はやり直される', async () => {
    const { strategy, mockPrisma } = build();
    mockPrisma.user.findUnique.mockResolvedValueOnce(null); // 1回目: 未登録
    await expect(strategy.validate(payload)).rejects.toThrow(
      ForbiddenException,
    );

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'uuid-1',
      roles: [],
    });
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: 'uuid-1',
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2); // 引き直している
  });
});
