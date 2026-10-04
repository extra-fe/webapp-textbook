import { LoggerService } from '@nestjs/common';
import { settleAll } from './settle-all';

describe('settleAll', () => {
  it('全件成功時に fulfilled に結果が入る', async () => {
    const result = await settleAll([
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(3),
    ]);

    expect(result.fulfilled).toEqual([1, 2, 3]);
    expect(result.rejected).toHaveLength(0);
  });

  it('全件失敗時に rejected に結果が入る', async () => {
    const result = await settleAll([
      Promise.reject(new Error('err1')),
      Promise.reject(new Error('err2')),
    ]);

    expect(result.fulfilled).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
  });

  it('部分失敗時に fulfilled と rejected が分かれる', async () => {
    const result = await settleAll([
      Promise.resolve('ok'),
      Promise.reject(new Error('fail')),
      Promise.resolve('ok2'),
    ]);

    expect(result.fulfilled).toEqual(['ok', 'ok2']);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBeInstanceOf(Error);
  });

  it('部分失敗時に logger.warn が呼ばれる', async () => {
    const logger = { warn: jest.fn() } satisfies Pick<LoggerService, 'warn'>;

    await settleAll(
      [Promise.resolve('ok'), Promise.reject(new Error('fail'))],
      logger,
      'TestContext',
    );

    expect(logger.warn).toHaveBeenCalledTimes(1);
    // 第2引数は context 文字列でなければならない。オブジェクトを渡すと
    // JsonLoggerService の context フィールドにそれが丸ごと入り、
    // context でのフィルタリングができなくなる。
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('1/2'),
      'TestContext',
    );
  });

  it('失敗の理由をメッセージに連結する', async () => {
    const logger = { warn: jest.fn() } satisfies Pick<LoggerService, 'warn'>;

    await settleAll(
      [
        Promise.reject(new Error('timeout')),
        Promise.reject(new Error('refused')),
      ],
      logger,
      'TestContext',
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('timeout'),
      'TestContext',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('refused'),
      'TestContext',
    );
  });

  it('全件成功時は logger.warn が呼ばれない', async () => {
    const logger = { warn: jest.fn() } satisfies Pick<LoggerService, 'warn'>;

    await settleAll([Promise.resolve('ok')], logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logger なしでも部分失敗時にエラーを throw しない', async () => {
    const result = await settleAll([
      Promise.resolve(1),
      Promise.reject(new Error('fail')),
    ]);

    expect(result.fulfilled).toEqual([1]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].status).toBe('rejected');
  });

  it('空配列を渡すと fulfilled も rejected も空', async () => {
    const result = await settleAll([]);

    expect(result.fulfilled).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});
