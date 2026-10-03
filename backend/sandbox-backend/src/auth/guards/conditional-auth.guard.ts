import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MockAuthGuard } from './mock-auth.guard';

@Injectable()
export class ConditionalAuthGuard implements CanActivate {
  private readonly guard: CanActivate;

  constructor() {
    this.guard =
      process.env.AUTH_ENABLED === 'false'
        ? new MockAuthGuard()
        : new (AuthGuard('jwt'))();
  }

  canActivate(context: ExecutionContext) {
    return this.guard.canActivate(context);
  }
}
