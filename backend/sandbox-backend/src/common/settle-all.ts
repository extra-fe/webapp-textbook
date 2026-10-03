import type { LoggerService } from '@nestjs/common';

export interface SettleAllResult<T> {
  fulfilled: T[];
  rejected: PromiseRejectedResult[];
}

/**
 * Promise.allSettled のラッパー。独立した並列処理で部分失敗を個別ハンドリングする。
 * 全件成功が必須なトランザクション的処理では Promise.all を使うこと。
 */
export async function settleAll<T>(
  promises: Promise<T>[],
  logger?: Pick<LoggerService, 'warn'>,
  context?: string,
): Promise<SettleAllResult<T>> {
  const results = await Promise.allSettled(promises);

  // 集計ループが核心：成功と失敗を2つの配列に振り分ける
  const fulfilled: T[] = [];
  const rejected: PromiseRejectedResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') fulfilled.push(result.value);
    else rejected.push(result);
  }

  // 失敗があればwarnログに件数と理由を残す
  if (rejected.length > 0 && logger) {
    // 第2引数は context 文字列。オブジェクトを渡すと JsonLoggerService の
    // context フィールドにそれが丸ごと入り、context でのフィルタリングが
    // できなくなる。LoggerService の第2引数以降は ...optionalParams: any[] な
    // ので型エラーにもならない。失敗の理由はメッセージ側に連結する。
    const reasons = rejected.map((r) => String(r.reason)).join(' / ');
    logger.warn(
      `settleAll: ${rejected.length}/${results.length} 件が失敗しました: ${reasons}`,
      context,
    );
  }
  return { fulfilled, rejected };
}
