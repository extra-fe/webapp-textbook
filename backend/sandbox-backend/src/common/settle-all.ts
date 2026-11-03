import { Logger } from '@nestjs/common';

/** settleAll の戻り値。成功した値と、失敗の理由を分けて持つ。 */
export interface SettledOutcome<T> {
  fulfilled: T[];
  rejected: Error[];
}

/** warn だけ使えればよいので、Logger 全体を要求しない（テストで差し替えやすい） */
export type WarnLogger = Pick<Logger, 'warn'>;

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

/**
 * 1件の失敗で残りを止めたくない処理のための薄いヘルパー。
 *
 * `Promise.allSettled` の結果を成功・失敗に振り分けて返し、失敗があれば
 * まとめて1行だけ warn に出す。呼ぶ側が毎回 `status` を見て分岐し、
 * ログの文面を考える手間を省くためのもの。
 *
 * 全件そろわないと意味がない処理（1つのトランザクションの一部など）には
 * 使わない。そこは `Promise.all` が正解で、1件の失敗で全体を止めるべき。
 *
 * @param tasks   並行して走らせる処理
 * @param context ログの `context` に入れる文字列
 * @param logger  差し替え用。省略すると `context` 名の Logger を作る
 */
export async function settleAll<T>(
  tasks: readonly Promise<T>[],
  context: string,
  logger: WarnLogger = new Logger(context),
): Promise<SettledOutcome<T>> {
  const results = await Promise.allSettled(tasks);

  const fulfilled: T[] = [];
  const rejected: Error[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') fulfilled.push(result.value);
    else rejected.push(toError(result.reason));
  }

  if (rejected.length > 0) {
    // 第2引数は context の「文字列」。ここにオブジェクトを渡すと
    // JsonLoggerService の context が潰れて、ログ検索で引けなくなる
    logger.warn(
      `${rejected.length}/${results.length} 件が失敗しました: ` +
        rejected.map((error) => error.message).join(' / '),
      context,
    );
  }

  return { fulfilled, rejected };
}
