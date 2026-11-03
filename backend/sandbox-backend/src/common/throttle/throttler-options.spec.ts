import { ConfigService } from '@nestjs/config';
import { resolveThrottlerOptions } from './throttler-options';

/** get(key, defaultValue) だけを持つ最小の ConfigService */
const makeConfig = (values: Record<string, number> = {}) =>
  ({
    get: <T>(key: string, defaultValue: T): T =>
      (values[key] as unknown as T) ?? defaultValue,
  }) as unknown as ConfigService;

describe('resolveThrottlerOptions', () => {
  it('登録するスロットラーは default の 1 つだけ', () => {
    // 名前付きスロットラーを複数並べると全エンドポイントに適用され、
    // 常に厳しい方が勝つ。崩れても例外は出ないのでテストで固定する。
    const options = resolveThrottlerOptions(makeConfig());

    expect(options).toHaveLength(1);
    expect(options.map((o) => o.name)).toEqual(['default']);
  });

  it('環境変数が無ければ 60 秒あたり 100 回を既定にする', () => {
    const [option] = resolveThrottlerOptions(makeConfig());

    expect(option.ttl).toBe(60000);
    expect(option.limit).toBe(100);
  });

  it('環境変数があればその値を使う', () => {
    const [option] = resolveThrottlerOptions(
      makeConfig({
        THROTTLE_DEFAULT_TTL_MS: 1000,
        THROTTLE_DEFAULT_LIMIT: 5,
      }),
    );

    expect(option.ttl).toBe(1000);
    expect(option.limit).toBe(5);
  });
});
