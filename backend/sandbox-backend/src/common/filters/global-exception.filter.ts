import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { Clock } from '../clock/clock';
import { ErrorCode } from '../errors/error-code.enum';
import { buildErrorResponse } from '../errors/error-response.dto';
import { logContextStorage } from '../logger/log-context';

// HttpStatus → ErrorCode の対応表。CONFLICT / BAD_REQUEST(=VALIDATION_ERROR) /
// UNAUTHORIZED / FORBIDDEN / TOO_MANY_REQUESTS は同名で素直に対応させる。
const HTTP_STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  // 4.4節のスロットリングで必ず発生する。埋めないと statusCode は 429 なのに
  // code が INTERNAL_SERVER_ERROR という矛盾したレスポンスになる
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
  // アプリのコードでは 404 を投げないが、ルート未一致のときは NestJS 自身が
  // 404 を返す。ここを埋めないと code が INTERNAL_SERVER_ERROR に丸められる
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
};

/**
 * HttpException ではないが HTTP ステータスを持つエラーから、4xx を取り出す。
 * body-parser のようにルーティングより手前で動くミドルウェアは、
 * PayloadTooLargeError のような素の Error に status を載せて投げてくる。
 */
const clientErrorStatusOf = (exception: unknown): number | undefined => {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const e = exception as { status?: unknown; statusCode?: unknown };
  const status =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : undefined;
  return status !== undefined && status >= 400 && status < 500
    ? status
    : undefined;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly clock: Clock) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    // AsyncLocalStorage は例外経路でも維持されるので、ここから traceId を取れる
    const requestId = logContextStorage.getStore()?.traceId ?? 'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        HTTP_STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL_SERVER_ERROR;
      const body = exception.getResponse();

      // ZodValidationPipe が返す errors 配列などの付加情報を落とさない
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const bodyObj = body as Record<string, unknown>;
        res.status(status).json({
          ...bodyObj,
          statusCode: status,
          code: bodyObj['code'] ?? code, // サービス層の明示があれば尊重する
          requestId,
          timestamp: this.clock.now().toISOString(),
        });
        return;
      }

      const message = typeof body === 'string' ? body : exception.message;
      res
        .status(status)
        .json(
          buildErrorResponse(status, code, message, requestId, () =>
            this.clock.now(),
          ),
        );
      return;
    }

    // ミドルウェア層が投げた 4xx。500 に丸めるとクライアント側の問題が
    // サーバー障害として記録され、アラートを汚す（6.4節）。
    const clientStatus = clientErrorStatusOf(exception);
    if (clientStatus !== undefined) {
      const code = HTTP_STATUS_TO_CODE[clientStatus] ?? ErrorCode.BAD_REQUEST;
      const message =
        exception instanceof Error ? exception.message : 'Bad request';
      res
        .status(clientStatus)
        .json(
          buildErrorResponse(clientStatus, code, message, requestId, () =>
            this.clock.now(),
          ),
        );
      return;
    }

    // 想定外の例外。クライアントには汎用メッセージだけ返し、詳細はログに残す
    const stack =
      exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(`Unhandled exception on ${req.method} ${req.url}`, stack);

    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        buildErrorResponse(
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.INTERNAL_SERVER_ERROR,
          'Internal server error',
          requestId,
          () => this.clock.now(),
        ),
      );
  }
}
