import type { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  name?: string;
  email?: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
