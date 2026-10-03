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

    super({
      adapter,
      transactionOptions: {
        // interactive transaction の既定は 5s。バッチを見越して 15s にする
        timeout: env('PRISMA_TX_TIMEOUT', 15_000),
        maxWait: env('PRISMA_TX_MAX_WAIT', 5_000),
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
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
