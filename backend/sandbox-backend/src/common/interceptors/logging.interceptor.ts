import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedRequest } from '../../auth/types';
import { logContextStorage } from '../logger/log-context';

/**
 * ログコンテキストに userId を足す。
 *
 * 開始・終了ログは RequestIdMiddleware が出している。ここに置くと、ガードが
 * 拒否したリクエスト（401 / 403）がインターセプターまで到達しないため記録されない。
 * NestJS の実行順序はミドルウェア → ガード → インターセプター。
 *
 * 逆に userId はここでしか分からない。ガードが request.user を設定するのは
 * ミドルウェアより後なので、ミドルウェア側では常に未設定になる。
 * 終了ログは finish イベント（このインターセプターより後）で出るため、
 * ここで詰めた userId はそちらに載る。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ctx = logContextStorage.getStore();
    if (ctx) {
      ctx.userId = req.user?.sub ?? 'anonymous';
    }
    return next.handle();
  }
}
