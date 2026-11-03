import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreakerService,
  CircuitOpenError,
} from './circuit-breaker.service';

export interface ExternalRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /**
   * 明示的に指定する Idempotency-Key。省略時は UUID v4 を自動生成する。
   * 同一操作をリトライする場合は同じキーを渡すこと。
   */
  idempotencyKey?: string;
  /**
   * サーキットブレーカーのキー。同じキーを使う呼び出しが共通のブレーカーを
   * 共有する。省略時はサーキットブレーカーを使わない。
   */
  circuitBreakerKey?: string;
}

export interface ExternalResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

/** 外部 API 呼び出し用 HTTP クライアント */
@Injectable()
export class ExternalHttpClient {
  private readonly logger = new Logger(ExternalHttpClient.name);

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  async get<T = unknown>(
    url: string,
    opts?: ExternalRequestOptions,
  ): Promise<ExternalResponse<T>> {
    return this.request<T>('GET', url, undefined, opts);
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    opts?: ExternalRequestOptions,
  ): Promise<ExternalResponse<T>> {
    return this.request<T>('POST', url, body, opts);
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    opts?: ExternalRequestOptions,
  ): Promise<ExternalResponse<T>> {
    return this.request<T>('PUT', url, body, opts);
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    opts?: ExternalRequestOptions,
  ): Promise<ExternalResponse<T>> {
    return this.request<T>('PATCH', url, body, opts);
  }

  async delete<T = unknown>(
    url: string,
    opts?: ExternalRequestOptions,
  ): Promise<ExternalResponse<T>> {
    return this.request<T>('DELETE', url, undefined, opts);
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    opts?: ExternalRequestOptions,
  ): Promise<ExternalResponse<T>> {
    // GET / HEAD はもともと冪等なので Idempotency-Key は付けない
    const isMutating = method !== 'GET' && method !== 'HEAD';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(isMutating
        ? { 'Idempotency-Key': opts?.idempotencyKey ?? randomUUID() }
        : {}),
      ...opts?.headers,
    };
    const timeoutMs = opts?.timeoutMs ?? 10_000;

    this.logger.log(
      `[request] ${method} ${url}` +
        (headers['Idempotency-Key']
          ? ` idempotencyKey=${headers['Idempotency-Key']}`
          : ''),
    );

    const doFetch = () =>
      this.doFetch<T>(method, url, headers, body, timeoutMs);

    if (opts?.circuitBreakerKey) {
      const breaker = this.circuitBreaker.getBreaker(opts.circuitBreakerKey);
      try {
        return await breaker.execute(doFetch);
      } catch (e) {
        if (e instanceof CircuitOpenError) {
          this.logger.warn(
            `[circuit-breaker] ${method} ${url} key=${opts.circuitBreakerKey} state=OPEN — リクエストを遮断しました`,
          );
        }
        throw e;
      }
    }

    return doFetch();
  }

  private async doFetch<T>(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: unknown,
    timeoutMs: number,
  ): Promise<ExternalResponse<T>> {
    // AbortControllerでデフォルト10秒のタイムアウトを実装する
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = (await res.json().catch((e: unknown) => {
        this.logger.warn(
          `[response] JSON parse failed ${method} ${url} status=${res.status}: ${String(e)}`,
        );
        return null;
      })) as T;

      this.logger.log(`[response] ${method} ${url} status=${res.status}`);

      return {
        status: res.status,
        headers: responseHeaders,
        body: responseBody,
      };
    } finally {
      clearTimeout(timer); // 正常応答時もタイマーをクリアしてリークを防ぐ
    }
  }
}
