import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types';

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    request.user = {
      id: process.env.MOCK_USER_ID ?? '00000000-0000-0000-0000-000000000001',
      sub: process.env.MOCK_USER_SUB ?? 'mock-user-id-123',
      name: 'Mock User',
      email: 'mock@example.com',
      roles: (process.env.MOCK_USER_ROLES ?? 'admin')
        .split(',')
        .map((r) => r.trim()),
    };

    return true;
  }
}
