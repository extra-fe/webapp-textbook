import { ConfigService } from '@nestjs/config';
import { ThrottlerOptions } from '@nestjs/throttler';

/**
 * ThrottlerModule に渡すスロットラー定義。
 *
 * **登録するのは 'default' 1 つだけ**にしている。名前付きスロットラーを複数
 * 並べると、そのすべてが全エンドポイントに適用され、常に厳しい方が勝つ。
 * つまり `strict` を並べた瞬間、`@StrictThrottle()` を付けていない経路まで
 * strict の上限に巻き込まれ、`default` の上限は意味を失う。
 *
 * 厳しくしたい経路は StrictThrottle デコレーターが 'default' の設定を
 * そのハンドラーだけ差し替える（src/common/decorators/strict-throttle.decorator.ts）。
 */
export const resolveThrottlerOptions = (
  config: ConfigService,
): ThrottlerOptions[] => [
  {
    name: 'default',
    ttl: config.get<number>('THROTTLE_DEFAULT_TTL_MS', 60000),
    limit: config.get<number>('THROTTLE_DEFAULT_LIMIT', 100),
  },
];
