import { Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

const logger = new Logger('withTransactionRetry');

/**
 * P2034（write conflict / deadlock）が発生した場合に最大 maxRetries 回まで
 * fn を再実行する。ReadCommitted（既定）では直列化失敗は起きないが
 * deadlock は起きうるため、トランザクションは常にこれ経由で呼ぶ。
 */
export async function withTransactionRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!isRetryable || attempt >= maxRetries) throw error;
      logger.warn(
        `[deadlock] P2034 detected, retrying (${attempt}/${maxRetries})`,
      );
    }
  }
}
