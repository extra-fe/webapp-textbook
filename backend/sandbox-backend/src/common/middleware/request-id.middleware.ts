import { Injectable, NestMiddleware } from '@nestjs/common';
import { isValidTraceId, trace } from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import { logContextStorage } from '../logger/log-context';

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const SESSION_ID_HEADER = 'X-Session-Id';

/**
 * ログに残す「誰からのリクエストか」を解決する。
 *
 * X-Forwarded-For を優先するのは、ロードバランサー配下では socket の接続元が
 * ロードバランサーになってしまうため。ただしこのヘッダーはクライアントが
 * 自由に書けるので、レート制限のキーには使えない（4.5 節で別に扱う）。
 */
function resolveClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return first.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? '';
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // main.ts と AppModule.configure() の 2 か所で登録しているため、
    // 1 リクエストで 2 回呼ばれる。2 回目は採番済みの値をそのまま活かす。
    // 再採番すると先に送出した X-Request-Id ヘッダーと食い違い、
    // AsyncLocalStorage も入れ子で張り直すことになる。1 回目が
    // logContextStorage.run() の中で next() を呼んでいるので、
    // ここで素通ししてもコンテキストは維持される。
    if ((req as Request & { requestId?: string }).requestId) {
      next();
      return;
    }

    // OTelが有効な場合はTrace IDをRequest IDとして使う。無効ならUUIDを採番
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    const requestId =
      traceId && isValidTraceId(traceId) ? traceId : crypto.randomUUID();

    // クライアントが送ってきたセッションIDを引き継ぐ（なければ新規生成）
    const incoming = req.headers[SESSION_ID_HEADER.toLowerCase()];
    const sessionId =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : crypto.randomUUID();

    const clientIp = resolveClientIp(req); // X-Forwarded-For優先、なければsocket
    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // AsyncLocalStorageでリクエストスコープのコンテキストを伝播させる
    logContextStorage.run({ traceId: requestId, sessionId, clientIp }, () =>
      next(),
    );
  }
}
