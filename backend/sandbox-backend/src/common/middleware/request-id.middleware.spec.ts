import { Logger } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import type { Request, Response } from 'express';
import { logContextStorage } from '../logger/log-context';
import type { LogContext } from '../logger/log-context';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
  SESSION_ID_HEADER,
} from './request-id.middleware';

/** 32 桁 16 進の有効な Trace ID（全 0 は無効扱いになる） */
const TRACE_ID = 'ac1ad0f9ad6542909929308af0eac409';

const makeReq = (
  headers: Record<string, string> = {},
  remoteAddress: string | undefined = '::1',
) => ({ headers, socket: { remoteAddress } }) as unknown as Request;

/**
 * 4.3 節から finish / close を購読するので `once` も生やしておく。
 * 登録されたハンドラーは `fire()` で呼び出せる。
 */
const makeRes = (statusCode = 200) => {
  const sent: Record<string, string> = {};
  const handlers: Record<string, (() => void)[]> = {};

  const setHeader = jest.fn((name: string, value: string): void => {
    sent[name] = value;
  });
  const once = jest.fn((event: string, handler: () => void): void => {
    handlers[event] = [...(handlers[event] ?? []), handler];
  });

  const res = { statusCode, setHeader, once } as unknown as Response;
  const fire = (event: string): void => {
    for (const handler of handlers[event] ?? []) handler();
  };

  return { res, sent, setHeader, once, fire };
};

/** ミドルウェアを 1 回通して、next() の内側で見えたコンテキストを返す */
const run = (middleware: RequestIdMiddleware, req: Request, res: Response) => {
  let context: LogContext | undefined;
  const next = jest.fn((): void => {
    context = logContextStorage.getStore();
  });
  middleware.use(req, res, next);
  return { context, next };
};

/** アクティブなスパンがある状態を作る */
const withActiveSpan = (traceId: string) =>
  jest.spyOn(trace, 'getActiveSpan').mockReturnValue({
    spanContext: () => ({ traceId, spanId: '0000000000000001', traceFlags: 1 }),
  } as unknown as ReturnType<typeof trace.getActiveSpan>);

/** テスト出力を汚さないようにロガーを黙らせる */
const muteLogger = () => ({
  log: jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
  warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
  error: jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
});

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    muteLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Request ID の出し分け', () => {
    it('OTel のアクティブスパンがあれば Trace ID をそのまま使う', () => {
      withActiveSpan(TRACE_ID);
      const { res, sent } = makeRes();

      const { context } = run(middleware, makeReq(), res);

      expect(context?.traceId).toBe(TRACE_ID);
      expect(sent[REQUEST_ID_HEADER]).toBe(TRACE_ID);
    });

    it('スパンが無ければ UUID を採番する', () => {
      jest.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);
      const { res } = makeRes();

      const { context } = run(middleware, makeReq(), res);

      expect(context?.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('Trace ID が不正な値なら UUID に落とす', () => {
      withActiveSpan('00000000000000000000000000000000');
      const { res } = makeRes();

      const { context } = run(middleware, makeReq(), res);

      expect(context?.traceId).not.toBe('00000000000000000000000000000000');
      expect(context?.traceId).toContain('-');
    });
  });

  describe('Session ID の引き継ぎ', () => {
    it('X-Session-Id が送られていればその値を引き継ぐ', () => {
      const req = makeReq({ [SESSION_ID_HEADER.toLowerCase()]: 'sess-abc' });

      const { context } = run(middleware, req, makeRes().res);

      expect(context?.sessionId).toBe('sess-abc');
    });

    it('X-Session-Id が無ければ新しく採番する', () => {
      const { context } = run(middleware, makeReq(), makeRes().res);

      expect(context?.sessionId).toContain('-');
    });
  });

  describe('クライアント IP の解決', () => {
    it('X-Forwarded-For があれば先頭の IP を使う', () => {
      const req = makeReq({ 'x-forwarded-for': '203.0.113.1, 198.51.100.7' });

      const { context } = run(middleware, req, makeRes().res);

      expect(context?.clientIp).toBe('203.0.113.1');
    });

    it('X-Forwarded-For が無ければソケットの接続元を使う', () => {
      const req = makeReq({}, '192.0.2.10');

      const { context } = run(middleware, req, makeRes().res);

      expect(context?.clientIp).toBe('192.0.2.10');
    });
  });

  describe('2 回呼ばれたとき（main.ts と AppModule の二重登録）', () => {
    it('再採番せず、ヘッダーも上書きしない', () => {
      jest.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);
      const req = makeReq();
      const { res, sent, setHeader } = makeRes();

      const first = run(middleware, req, res);
      const issued = first.context?.traceId;
      expect(setHeader).toHaveBeenCalledTimes(1);

      // 2 回目。1 回目が requestId を立てているので素通りする
      const second = jest.fn();
      middleware.use(req, res, second);

      expect(setHeader).toHaveBeenCalledTimes(1);
      expect(sent[REQUEST_ID_HEADER]).toBe(issued);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});
