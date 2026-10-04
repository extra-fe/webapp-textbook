import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

const env = (key: string, fallback: number) =>
  process.env[key] ? Number(process.env[key]) : fallback;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: env('DATABASE_POOL_MAX', 10), // 最大接続数
      min: env('DATABASE_POOL_MIN', 2), // 最小アイドル接続数
      idleTimeoutMillis: env('DATABASE_POOL_IDLE_TIMEOUT_MS', 10_000), // アイドル解放まで
      connectionTimeoutMillis: env('DATABASE_CONNECTION_TIMEOUT_MS', 5_000), // 接続獲得タイムアウト
    });

    // --- N+1 検出用クエリログ設定（6.3節）---
    // query は $on で受け取るため常に emit: 'event'。それ以外は stdout へ流す。
    const rawLevels = process.env.PRISMA_LOG_LEVEL?.split(',') ?? [];
    const isDevQueryLog =
      process.env.NODE_ENV === 'development' && rawLevels.includes('query');
    const log: Prisma.LogDefinition[] = [
      { level: 'query', emit: 'event' },
      ...rawLevels
        .filter((l) => l !== 'query')
        .map((level) => ({
          level: level as Prisma.LogLevel,
          emit: 'stdout' as const,
        })),
    ];

    super({
      adapter,
      log,
      transactionOptions: {
        // interactive transaction の既定は 5s。バッチを見越して 15s にする
        timeout: env('PRISMA_TX_TIMEOUT', 15_000),
        maxWait: env('PRISMA_TX_MAX_WAIT', 5_000),
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    });

    // log を動的な配列で組み立てているため、TypeScript は $on の
    // イベント名を never に推論してしまう。ここだけ型を明示する。
    // $on('query') は $connect() より前（コンストラクタ内）で登録する必要がある。
    (
      this as unknown as {
        $on: (event: string, cb: (e: Prisma.QueryEvent) => void) => void;
      }
    ).$on('query', (e) => {
      // 開発時は全クエリを params 付きで出力（N+1 検出）。
      // e.duration は 106.80580000000009 のような浮動小数で来るので丸める。
      if (isDevQueryLog) {
        this.logger.debug(
          `[query] ${e.query} | params=${e.params} | ${Math.round(e.duration)}ms`,
        );
      }
    });
  }

  async onModuleInit() {
    const maxRetries = env('DATABASE_CONNECT_RETRY_COUNT', 3);
    const retryInterval = env('DATABASE_CONNECT_RETRY_INTERVAL_MS', 3_000);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        // ドライバーアダプター構成の $connect() は実際の接続を張らない
        // （遅延接続）。DB が落ちていても成功してしまうので、軽いクエリを
        // 1 回投げて本当に到達できることを確かめる。
        await this.$queryRaw`SELECT 1`;
        return;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        this.logger.warn(
          `DB接続失敗 (attempt ${attempt}/${maxRetries})、${retryInterval}ms後にリトライします`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
