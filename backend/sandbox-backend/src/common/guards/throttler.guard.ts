import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * X-Forwarded-For はクライアントが任意の値を送れるため、
 * レート制限のトラッカーキーには使わず、TCP接続元IPを使う。
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(req.socket.remoteAddress ?? 'unknown');
  }
}
