import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { logContextStorage } from '../logger/log-context';
import type { LogContext } from '../logger/log-context';
import { LoggingInterceptor } from './logging.interceptor';

const makeContext = (user?: { sub: string }) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const makeNext = () => {
  const handle = jest.fn(() => of('ok'));
  return { next: { handle } as unknown as CallHandler, handle };
};

/** ALS のコンテキストを張った状態で intercept を通す */
const interceptWithin = (
  interceptor: LoggingInterceptor,
  context: ExecutionContext,
  seed: Partial<LogContext> = {},
) => {
  const store: LogContext = {
    traceId: 'trace-1',
    sessionId: 'session-1',
    ...seed,
  };
  const { next, handle } = makeNext();
  const result = logContextStorage.run(store, () =>
    interceptor.intercept(context, next),
  );
  return { store, handle, result };
};

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let levels: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    levels = {
      log: jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('userId の付与', () => {
    it('認証済みなら request.user.sub をコンテキストに詰める', () => {
      const { store } = interceptWithin(
        interceptor,
        makeContext({ sub: 'user-123' }),
      );

      expect(store.userId).toBe('user-123');
    });

    it('未認証なら anonymous を詰める', () => {
      const { store } = interceptWithin(interceptor, makeContext(undefined));

      expect(store.userId).toBe('anonymous');
    });

    it('ALS のコンテキストが無いときは何もせずに通す', () => {
      const { next, handle } = makeNext();

      expect(() =>
        interceptor.intercept(makeContext({ sub: 'user-123' }), next),
      ).not.toThrow();
      expect(handle).toHaveBeenCalledTimes(1);
    });
  });

  describe('開始・終了ログは出さない', () => {
    // 出すのは RequestIdMiddleware。ここに戻すと、ガードが拒否した
    // リクエスト（401 / 403）がインターセプターまで来ないため記録が漏れる。
    it('ログを 1 行も出さずに next へ渡す', () => {
      const { handle } = interceptWithin(
        interceptor,
        makeContext({ sub: 'user-123' }),
      );

      expect(levels.log).not.toHaveBeenCalled();
      expect(levels.warn).not.toHaveBeenCalled();
      expect(levels.error).not.toHaveBeenCalled();
      expect(handle).toHaveBeenCalledTimes(1);
    });
  });
});
