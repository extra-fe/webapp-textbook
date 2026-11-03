import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

// super() に渡したオプションを受け取るための入れ物
const constructorOptions: Record<string, unknown>[] = [];

// 生成された Prisma クライアントを差し替える。DB に触らないためだが、
// Prisma 7 のクライアントは WASM のクエリコンパイラを動的 import() で読むので、
// 実物を Jest の中で読まずに済ませる効果もある。
jest.mock('../generated/prisma/client', () => {
  const MockPrismaClient = jest.fn().mockImplementation(function (
    this: {
      $connect: jest.Mock;
      $disconnect: jest.Mock;
      $queryRaw: jest.Mock;
      $on: jest.Mock;
    },
    options: Record<string, unknown>,
  ) {
    constructorOptions.push(options);
    this.$connect = jest.fn().mockResolvedValue(undefined);
    this.$disconnect = jest.fn().mockResolvedValue(undefined);
    this.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    // 6.3節でコンストラクタが $on('query') を登録するので、モックにも要る
    this.$on = jest.fn();
  });
  return {
    PrismaClient: MockPrismaClient,
    Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' } },
  };
});

const build = async (): Promise<[TestingModule, PrismaService]> => {
  const module = await Test.createTestingModule({
    providers: [PrismaService],
  }).compile();
  return [module, module.get<PrismaService>(PrismaService)];
};

describe('PrismaService', () => {
  beforeEach(() => {
    constructorOptions.length = 0;
    delete process.env.DATABASE_CONNECT_RETRY_COUNT;
    delete process.env.DATABASE_CONNECT_RETRY_INTERVAL_MS;
    delete process.env.PRISMA_TX_TIMEOUT;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('シャットダウンフック', () => {
    it('onApplicationShutdown で $disconnect が呼ばれる', async () => {
      const [, service] = await build();
      const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();
      await service.onApplicationShutdown();
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    // SIGTERM 受信時に NestJS が実行するのと同じ経路。フックの結線が外れたら
    // ここで気づける（Windows では SIGTERM 自体を送れないため、この形で固定する）。
    it('app.close() で onApplicationShutdown が呼ばれる', async () => {
      const [module] = await build();
      const app = module.createNestApplication();
      app.enableShutdownHooks();
      await app.init();

      const spy = jest.spyOn(app.get(PrismaService), 'onApplicationShutdown');
      await app.close();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('起動時の接続確認とリトライ', () => {
    // $connect() は遅延接続なので、これが消えると DB が停止していても
    // アプリが起動してしまう。消えたことに気づくためのテスト。
    it('$connect だけでなくクエリを1回投げて到達性を確かめる', async () => {
      const [, service] = await build();
      const queryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockResolvedValue([{ '?column?': 1 }]);

      await service.onModuleInit();

      expect(queryRaw).toHaveBeenCalled();
    });

    it('クエリが失敗したらリトライし、成功したら抜ける', async () => {
      process.env.DATABASE_CONNECT_RETRY_COUNT = '3';
      process.env.DATABASE_CONNECT_RETRY_INTERVAL_MS = '1';
      const [, service] = await build();
      const queryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce([{ '?column?': 1 }]);

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(queryRaw).toHaveBeenCalledTimes(2);
    });

    it('リトライ回数を使い切ったら投げ直す', async () => {
      process.env.DATABASE_CONNECT_RETRY_COUNT = '2';
      process.env.DATABASE_CONNECT_RETRY_INTERVAL_MS = '1';
      const [, service] = await build();
      const queryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.onModuleInit()).rejects.toThrow('ECONNREFUSED');
      expect(queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('transactionOptions', () => {
    it('既定では timeout 15秒・maxWait 5秒・ReadCommitted になる', async () => {
      await build();
      expect(constructorOptions[0].transactionOptions).toEqual({
        timeout: 15_000,
        maxWait: 5_000,
        isolationLevel: 'ReadCommitted',
      });
    });

    it('環境変数で上書きできる', async () => {
      process.env.PRISMA_TX_TIMEOUT = '30000';
      await build();
      expect(
        (constructorOptions[0].transactionOptions as { timeout: number })
          .timeout,
      ).toBe(30_000);
    });
  });
});
