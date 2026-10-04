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
import type { IIdpProvider } from '../idp/idp-provider.interface';
import type { AuthenticatedUser } from '../types';
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

type MockPrisma = { user: { findUnique: jest.Mock } };
type MockCache = { get: jest.Mock; set: jest.Mock; del: jest.Mock };

const build = () => {
  const prisma: MockPrisma = { user: { findUnique: jest.fn() } };
  const cache: MockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
  };
  // TestingModule を通さず直接 new する。validate() のテストでも
  // Prisma と Cache はモックなので、DBもKeycloakも要らない。
  const strategy = new JwtStrategy(
    mockIdp,
    prisma as never,
    cache as unknown as Cache,
  );
  return { strategy, prisma, cache };
};

describe('JwtStrategy の検証設定', () => {
  beforeEach(() => {
    mockStrategyConstructor.mockClear();
  });

  /** super() に渡ったオプションオブジェクトを取り出す */
  const captureConstructorOpts = (): Record<string, unknown> => {
    build();
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

describe('JwtStrategy のシングルフライト', () => {
  const payload = { sub: 'keycloak-sub-1', email: 'a@example.com', name: 'A' };

  it('50 並列のキャッシュミスでも DB クエリは 1 回に畳まれる', async () => {
    const { strategy, prisma } = build();
    let resolveDb: ((v: unknown) => void) | undefined;
    prisma.user.findUnique.mockReturnValue(
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

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('キャッシュが温まっていれば DB を引かない', async () => {
    const { strategy, prisma, cache } = build();
    const cached: AuthenticatedUser = {
      id: 'uuid-1',
      sub: 'keycloak-sub-1',
      roles: ['viewer'],
    };
    cache.get.mockResolvedValue(cached);

    await Promise.all(
      Array.from({ length: 50 }, () => strategy.validate(payload)),
    );

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  // 「3回とも ForbiddenException が出る」だけでは finally の有無を区別できない。
  // 失敗のあとに DB が復旧したら引き直せるか、まで見る。
  it('DB 取得が失敗しても inflight が掃除され、次の取得はやり直される', async () => {
    const { strategy, prisma } = build();
    prisma.user.findUnique.mockResolvedValueOnce(null); // 1回目: 未登録
    await expect(strategy.validate(payload)).rejects.toThrow(
      ForbiddenException,
    );

    prisma.user.findUnique.mockResolvedValueOnce({ id: 'uuid-1', roles: [] });
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: 'uuid-1',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2); // 引き直している
  });
});
