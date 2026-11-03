import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './types';

@Controller('auth')
export class AuthController {
  // 認証はグローバルに掛かっているので @UseGuards は要らない
  @Get('me')
  me(@Req() req: AuthenticatedRequest): AuthenticatedUser | undefined {
    return req.user;
  }
}
