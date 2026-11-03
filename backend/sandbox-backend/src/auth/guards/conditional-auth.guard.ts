import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_ANONYMOUS_KEY } from '../decorators/allow-anonymous.decorator';
import { MockAuthGuard } from './mock-auth.guard';

@Injectable()
export class ConditionalAuthGuard implements CanActivate {
  private readonly guard: CanActivate;

  constructor(private readonly reflector: Reflector) {
    this.guard =
      process.env.AUTH_ENABLED === 'false'
        ? new MockAuthGuard()
        : new (AuthGuard('jwt'))();
  }

  canActivate(context: ExecutionContext) {
    // ハンドラーとクラスの両方を見て、先に見つかったほうを採る。
    // クラスに付ければコントローラー全体が認証不要になる。
    const isAnonymous = this.reflector.getAllAndOverride<boolean>(
      IS_ANONYMOUS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isAnonymous) return true;

    return this.guard.canActivate(context);
  }
}
