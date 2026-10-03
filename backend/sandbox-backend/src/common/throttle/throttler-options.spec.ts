import { ConfigService } from '@nestjs/config';
import { resolveThrottlerOptions } from './throttler-options';

const makeConfig = (values: Record<string, number> = {}): ConfigService =>
  ({
    get: <T>(key: string, fallback: T): T =>
      (values[key] as unknown as T) ?? fallback,
  }) as unknown as ConfigService;

describe('resolveThrottlerOptions', () => {
  // 名前付きスロットラーを複数登録すると、そのすべてが全エンドポイントに
  // 適用されて常に厳しい方が勝つ。@StrictThrottle を付けていない経路まで
  // strict の上限に巻き込まれ、default の上限が意味を失う。
  // 壊れても例外は出ないので、「登録は default 1 つだけ」をここで固定する。
  it('登録するスロットラーは default 1 つだけ', () => {
    const options = resolveThrottlerOptions(makeConfig());

    expect(options).toHaveLength(1);
    expect(options[0].name).toBe('default');
  });

  it('環境変数が未設定なら 1 分 100 リクエスト', () => {
    const [option] = resolveThrottlerOptions(makeConfig());

    expect(option.ttl).toBe(60000);
    expect(option.limit).toBe(100);
  });

  it('THROTTLE_DEFAULT_* で上書きできる', () => {
    const [option] = resolveThrottlerOptions(
      makeConfig({
        THROTTLE_DEFAULT_TTL_MS: 1000,
        THROTTLE_DEFAULT_LIMIT: 5,
      }),
    );

    expect(option.ttl).toBe(1000);
    expect(option.limit).toBe(5);
  });

  it('THROTTLE_STRICT_* はここでは読まない（デコレーター側の責務）', () => {
    const [option] = resolveThrottlerOptions(
      makeConfig({
        THROTTLE_STRICT_TTL_MS: 1000,
        THROTTLE_STRICT_LIMIT: 2,
      }),
    );

    expect(option.limit).toBe(100);
  });
});
