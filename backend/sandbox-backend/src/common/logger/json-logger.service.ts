import { LoggerService, LogLevel } from '@nestjs/common';
import { logContextStorage } from './log-context';

const LEVEL_ORDER: Record<string, number> = {
  verbose: 0,
  debug: 1,
  log: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

export class JsonLoggerService implements LoggerService {
  private readonly minLevel: number;
  private readonly serviceName: string;

  constructor(level: LogLevel = 'error') {
    this.minLevel = LEVEL_ORDER[level] ?? LEVEL_ORDER['error'];
    this.serviceName = process.env.OTEL_SERVICE_NAME ?? '';
  }

  private isEnabled(level: string): boolean {
    return (LEVEL_ORDER[level] ?? 0) >= this.minLevel;
  }

  // ログエントリの組み立てが本サービスの核心
  private buildEntry(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ): Record<string, unknown> {
    const ctx = logContextStorage.getStore();
    // Error は自身のプロパティが列挙不可なため JSON.stringify すると {} になる。
    // NestJS 内部の ExceptionHandler は Error オブジェクトをそのまま渡してくるので、
    // ここで message / stack を取り出さないと起動失敗が無言のログになる。
    const isError = message instanceof Error;
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? '',
      message: isError ? message.message : message,
    };
    if (isError && trace === undefined) trace = message.stack;
    if (this.serviceName) entry.serviceName = this.serviceName;
    // AsyncLocalStorageからリクエストスコープの情報を取得して付与する
    if (ctx) {
      entry.traceId = ctx.traceId;
      entry.sessionId = ctx.sessionId;
      for (const k of [
        'userId',
        'clientIp',
        'httpMethod',
        'httpPath',
        'statusCode',
        'durationMs',
      ] as const) {
        if (ctx[k] !== undefined) entry[k] = ctx[k];
      }
    }
    if (trace) entry.trace = trace;
    return entry;
  }

  // log / warn / debug / verbose は stdout、error / fatal は stderr へ書く。
  // どれも「レベル判定 → buildEntry → 1行JSON出力」の同型。
  log(message: unknown, context?: string): void {
    if (!this.isEnabled('log')) return;
    process.stdout.write(
      JSON.stringify(this.buildEntry('log', message, context)) + '\n',
    );
  }

  error(message: unknown, trace?: string, context?: string): void {
    if (!this.isEnabled('error')) return;
    process.stderr.write(
      JSON.stringify(this.buildEntry('error', message, context, trace)) + '\n',
    );
  }

  warn(message: unknown, context?: string): void {
    if (!this.isEnabled('warn')) return;
    process.stdout.write(
      JSON.stringify(this.buildEntry('warn', message, context)) + '\n',
    );
  }

  debug(message: unknown, context?: string): void {
    if (!this.isEnabled('debug')) return;
    process.stdout.write(
      JSON.stringify(this.buildEntry('debug', message, context)) + '\n',
    );
  }

  verbose(message: unknown, context?: string): void {
    if (!this.isEnabled('verbose')) return;
    process.stdout.write(
      JSON.stringify(this.buildEntry('verbose', message, context)) + '\n',
    );
  }

  fatal(message: unknown, context?: string): void {
    if (!this.isEnabled('fatal')) return;
    process.stderr.write(
      JSON.stringify(this.buildEntry('fatal', message, context)) + '\n',
    );
  }
}
