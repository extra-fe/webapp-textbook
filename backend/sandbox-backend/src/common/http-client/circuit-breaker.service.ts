import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  Closed = 'CLOSED',
  Open = 'OPEN',
  HalfOpen = 'HALF-OPEN',
}

/** サーキットが Open 状態でリクエストを遮断したときに投げる例外 */
export class CircuitOpenError extends Error {
  constructor(key: string) {
    super(
      `Circuit is open for "${key}" — request blocked to prevent cascading failure`,
    );
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerConfig {
  /** Open に移行する連続失敗数（既定: 5） */
  consecutiveFailures?: number;
  /** Open 後に Half-Open へ移行するまでの待機時間 ms（既定: 30_000） */
  halfOpenAfterMs?: number;
}

export class CircuitBreaker {
  private state = CircuitState.Closed;
  private failures = 0;
  private openedAt = 0;

  constructor(
    readonly key: string,
    private readonly threshold: number,
    private readonly halfOpenAfterMs: number,
    private readonly logger: Logger,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.Open) {
      if (Date.now() - this.openedAt >= this.halfOpenAfterMs) {
        this.transition(CircuitState.HalfOpen);
      } else {
        throw new CircuitOpenError(this.key); // 外部へ行かない
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      if (e instanceof CircuitOpenError) throw e;
      this.onFailure();
      throw e;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === CircuitState.HalfOpen) {
      this.transition(CircuitState.Closed);
    }
  }

  private onFailure(): void {
    this.failures++;
    // Half-Open で1回失敗したら即 Open に戻す
    if (
      this.state === CircuitState.HalfOpen ||
      this.failures >= this.threshold
    ) {
      this.transition(CircuitState.Open);
    }
  }

  private transition(next: CircuitState): void {
    const prev = this.state;
    this.state = next;
    if (next === CircuitState.Open) {
      this.openedAt = Date.now();
      this.logger.warn(
        `[circuit-breaker] key=${this.key} ${prev}→OPEN consecutiveFailures=${this.failures}`,
      );
    } else {
      this.logger.log(`[circuit-breaker] key=${this.key} ${prev}→${next}`);
    }
  }
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  /**
   * 指定キーのサーキットブレーカーを返す。初回呼び出し時に生成する。
   * config は初回生成時のみ有効で、既存のブレーカーには影響しない。
   */
  getBreaker(key: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(key)) {
      const threshold = config?.consecutiveFailures ?? 5;
      const halfOpenAfterMs = config?.halfOpenAfterMs ?? 30_000;
      this.breakers.set(
        key,
        new CircuitBreaker(key, threshold, halfOpenAfterMs, this.logger),
      );
    }
    return this.breakers.get(key)!;
  }
}
