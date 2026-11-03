import { AsyncLocalStorage } from 'async_hooks';

export interface LogContext {
  traceId: string;
  sessionId: string;
  userId?: string;
  clientIp?: string;
  httpMethod?: string;
  httpPath?: string;
  statusCode?: number;
  durationMs?: number;
}

export const logContextStorage = new AsyncLocalStorage<LogContext>();
