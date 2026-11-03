import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConditionalAuthGuard } from './guards/conditional-auth.guard';
import type { AuthenticatedRequest, AuthenticatedUser } from './types';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(ConditionalAuthGuard)
  me(@Req() req: AuthenticatedRequest): AuthenticatedUser | undefined {
    return req.user;
  }
}
