import { validateEnv } from './env-validation';

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env['DATABASE_URL'] = 'postgresql://localhost/test';
    process.env['KEYCLOAK_URL'] = 'http://localhost:8080';
    process.env['KEYCLOAK_REALM'] = 'local';
    delete process.env['AUTH_ENABLED'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('必須変数が揃っている場合はエラーなし', () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it('DATABASE_URL が未設定の場合はエラーをスロー', () => {
    delete process.env['DATABASE_URL'];
    expect(() => validateEnv()).toThrow('DATABASE_URL');
  });

  it('AUTH_ENABLED=false の場合は IdP 変数チェックをスキップする', () => {
    process.env['AUTH_ENABLED'] = 'false';
    delete process.env['KEYCLOAK_URL'];
    delete process.env['KEYCLOAK_REALM'];
    expect(() => validateEnv()).not.toThrow();
  });

  it('KEYCLOAK_URL が未設定の場合はエラーをスロー', () => {
    delete process.env['KEYCLOAK_URL'];
    expect(() => validateEnv()).toThrow('KEYCLOAK_URL');
  });

  it('KEYCLOAK_REALM が未設定の場合はエラーをスロー', () => {
    delete process.env['KEYCLOAK_REALM'];
    expect(() => validateEnv()).toThrow('KEYCLOAK_REALM');
  });

  it('DATABASE_URL と IdP 変数が両方未設定の場合はまとめてエラーに含む', () => {
    delete process.env['DATABASE_URL'];
    delete process.env['KEYCLOAK_URL'];
    delete process.env['KEYCLOAK_REALM'];
    const error = expect(() => validateEnv());
    error.toThrow('DATABASE_URL');
  });

  // ConfigModule.forRoot({ validate }) は `.env` の読み込み結果と process.env を
  // マージしたオブジェクトを渡してくる。この時点では `.env` 由来の値はまだ
  // process.env に入っていないため、検証は引数側を見なければならない。
  describe('env を明示的に渡した場合', () => {
    it('process.env ではなく引数のオブジェクトを検証する', () => {
      delete process.env['DATABASE_URL'];

      expect(() =>
        validateEnv({
          DATABASE_URL: 'postgresql://localhost/from-dotenv',
          KEYCLOAK_URL: 'http://localhost:8080',
          KEYCLOAK_REALM: 'local',
        }),
      ).not.toThrow();
    });

    it('process.env に値があっても引数に無ければエラーをスロー', () => {
      // process.env 側は beforeEach で揃っているが、引数側が空なら弾く
      expect(() => validateEnv({ AUTH_ENABLED: 'false' })).toThrow(
        'DATABASE_URL',
      );
    });

    it('引数側の AUTH_ENABLED=false で IdP チェックをスキップする', () => {
      expect(() =>
        validateEnv({
          DATABASE_URL: 'postgresql://localhost/test',
          AUTH_ENABLED: 'false',
        }),
      ).not.toThrow();
    });
  });
});
