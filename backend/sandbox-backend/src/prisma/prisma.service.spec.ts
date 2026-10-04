import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('シャットダウンフック', () => {
    // SIGTERM 受信時に NestJS が実行するのと同じ経路。フックの結線が外れたら
    // ここで気づける（Windows では SIGTERM 自体を送れないため、この形で固定する）。
    it('app.close() で onApplicationShutdown が呼ばれる', async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        providers: [PrismaService],
      }).compile();

      const app = moduleFixture.createNestApplication();
      app.enableShutdownHooks();

      // onModuleInit の疎通確認クエリ（4.7節）を黙らせる。
      // DB を立てずに結線だけを見たいため。
      const prisma = app.get(PrismaService);
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
      const shutdownSpy = jest.spyOn(prisma, 'onApplicationShutdown');

      await app.init();
      await app.close();

      expect(shutdownSpy).toHaveBeenCalled();
      // カバレッジ計測下では Prisma クライアントの読み込みが遅く、
      // 既定の5秒では間に合わない（pnpm test は通るのに test:cov だけ落ちる）
    }, 30_000);
  });

  describe('起動時の接続確認とリトライ', () => {
    let module: TestingModule;
    let service: PrismaService;

    beforeEach(async () => {
      delete process.env.DATABASE_CONNECT_RETRY_COUNT;
      delete process.env.DATABASE_CONNECT_RETRY_INTERVAL_MS;
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      module = await Test.createTestingModule({
        providers: [PrismaService],
      }).compile();
      service = module.get<PrismaService>(PrismaService);
      jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    });

    // $connect() は遅延接続なので、これが消えると DB が停止していても
    // アプリが起動してしまう。消えたことに気づくためのテスト。
    it('$connect だけでなくクエリを1回投げて到達性を確かめる', async () => {
      const queryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockResolvedValue([{ '?column?': 1 }]);

      await service.onModuleInit();

      expect(queryRaw).toHaveBeenCalled();
    });

    it('クエリが失敗したらリトライし、成功したら抜ける', async () => {
      process.env.DATABASE_CONNECT_RETRY_COUNT = '3';
      process.env.DATABASE_CONNECT_RETRY_INTERVAL_MS = '1';
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
      const queryRaw = jest
        .spyOn(service, '$queryRaw')
        .mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.onModuleInit()).rejects.toThrow('ECONNREFUSED');
      expect(queryRaw).toHaveBeenCalledTimes(2);
    });
  });
});
