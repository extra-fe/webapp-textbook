import { Throttle } from '@nestjs/throttler';

const num = (key: string, fallback: number): number =>
  process.env[key] ? Number(process.env[key]) : fallback;

/**
 * ブルートフォース攻撃対策が必要なエンドポイントに付与する。
 * 閾値は THROTTLE_STRICT_TTL_MS / THROTTLE_STRICT_LIMIT 環境変数で制御する。
 *
 * 上書きするのは 'default'。別名（'strict' など）を指定しても、その名前の
 * スロットラーが ThrottlerModule に登録されていなければ何も起きない。
 *
 * ttl / limit は関数として渡す。Resolvable<number> なので @nestjs/throttler が
 * リクエストごとに呼んでくれる。数値をそのまま渡すとデコレーター評価時
 * （モジュール読み込み時 = ConfigModule が .env を読む前）に固定されてしまい、
 * .env の値もテストからの差し替えも効かなくなる。
 */
export const StrictThrottle = () =>
  Throttle({
    default: {
      // 数値ではなく関数を渡す
      ttl: () => num('THROTTLE_STRICT_TTL_MS', 60_000),
      limit: () => num('THROTTLE_STRICT_LIMIT', 10),
    },
  });
