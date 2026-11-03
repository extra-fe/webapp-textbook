import { validateIdpConfig } from './idp-config';

const base = {
  KEYCLOAK_URL: 'http://localhost:8080',
  KEYCLOAK_REALM: 'sandbox',
};

describe('validateIdpConfig', () => {
  it('必須変数が揃っている場合はエラーなし', () => {
    expect(() => validateIdpConfig({ ...base })).not.toThrow();
  });

  it('AUTH_ENABLED=false の場合は何も検証しない', () => {
    expect(() => validateIdpConfig({ AUTH_ENABLED: 'false' })).not.toThrow();
  });

  it('KEYCLOAK_URL が未設定の場合はエラーをスロー', () => {
    expect(() => validateIdpConfig({ KEYCLOAK_REALM: 'sandbox' })).toThrow(
      'Missing required IdP environment variables: KEYCLOAK_URL',
    );
  });

  it('KEYCLOAK_REALM が未設定の場合はエラーをスロー', () => {
    expect(() =>
      validateIdpConfig({ KEYCLOAK_URL: 'http://localhost:8080' }),
    ).toThrow('Missing required IdP environment variables: KEYCLOAK_REALM');
  });

  it('両方未設定の場合はまとめてエラーに含む', () => {
    expect(() => validateIdpConfig({})).toThrow(
      'Missing required IdP environment variables: KEYCLOAK_URL, KEYCLOAK_REALM',
    );
  });

  // 2.7節で足した aud 検証用の変数。未設定なら getAudience() が undefined を
  // 返して検証をスキップする設計なので、ここでは必須にしない
  it('KEYCLOAK_AUDIENCE は未設定でもエラーにならない', () => {
    expect(() => validateIdpConfig({ ...base })).not.toThrow();
    expect(() =>
      validateIdpConfig({ ...base, KEYCLOAK_AUDIENCE: 'sandbox-api' }),
    ).not.toThrow();
  });
});
