import { resolveCorsConfig } from './cors-config';

describe('resolveCorsConfig', () => {
  it('両方未設定の場合は enabled: false を返す', () => {
    expect(resolveCorsConfig(undefined, undefined)).toEqual({ enabled: false });
  });

  it('両方設定済みの場合は enabled: true とパース済みの配列を返す', () => {
    expect(
      resolveCorsConfig(
        'https://example.com,https://app.example.com',
        'GET,POST',
      ),
    ).toEqual({
      enabled: true,
      origin: ['https://example.com', 'https://app.example.com'],
      methods: ['GET', 'POST'],
    });
  });

  it('CORS_ORIGIN のみ設定された場合はエラーをスロー', () => {
    expect(() => resolveCorsConfig('https://example.com', undefined)).toThrow(
      'CORS_ORIGIN and CORS_METHODS must both be set or both be unset',
    );
  });

  it('CORS_METHODS のみ設定された場合はエラーをスロー', () => {
    expect(() => resolveCorsConfig(undefined, 'GET,POST')).toThrow(
      'CORS_ORIGIN and CORS_METHODS must both be set or both be unset',
    );
  });
});
