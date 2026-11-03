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
    // PrismaService は空オブジェクトで足りる。
    new JwtStrategy(mockIdp, {} as never);
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
