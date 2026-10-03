import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import type { Clock } from '../clock/clock';
import { ErrorCode } from '../errors/error-code.enum';
import { buildErrorResponse } from '../errors/error-response.dto';
import { logContextStorage } from '../logger/log-context';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(private readonly clock: Clock) {}

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = logContextStorage.getStore()?.traceId ?? 'unknown';

    this.logger.warn(
      `Prisma error ${exception.code} on ${req.method} ${req.url}`,
    );

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    switch (exception.code) {
      case 'P2002': // 一意制約違反
        status = HttpStatus.CONFLICT;
        code = ErrorCode.CONFLICT;
        message = '既に同じ内容のデータが存在します';
        break;
      case 'P2025': // レコード未存在（404 ではなく 422）
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        code = ErrorCode.NOT_FOUND;
        message = '対象のデータが見つかりません';
        break;
      case 'P2003': // 外部キー制約違反
        status = HttpStatus.BAD_REQUEST;
        code = ErrorCode.BAD_REQUEST;
        message = '関連するデータが存在しません';
        break;
    }

    res
      .status(status)
      .json(
        buildErrorResponse(status, code, message, requestId, () =>
          this.clock.now(),
        ),
      );
  }
}
