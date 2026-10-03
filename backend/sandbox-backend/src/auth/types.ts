import type { Request } from 'express';

export interface AuthenticatedUser {
  /** アプリ側のユーザーID（users.id）。監査カラムに記録するのはこちら */
  id: string;
  /** IdP が発行した識別子（JWT の sub クレーム） */
  sub: string;
  name?: string;
  email?: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
