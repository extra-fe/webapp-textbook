import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types';

/** 操作者のユーザーID（users.id）を取り出す。races.createdBy に記録する値。 */
export const OperatorId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user!.id;
  },
);
