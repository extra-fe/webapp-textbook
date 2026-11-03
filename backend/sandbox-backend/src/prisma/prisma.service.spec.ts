import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

// 生成された Prisma クライアントを差し替える。DB に触らないためだが、
// Prisma 7 のクライアントは WASM のクエリコンパイラを動的 import() で読むので、
// 実物を Jest の中で読まずに済ませる効果もある。
jest.mock('../generated/prisma/client', () => {
  const MockPrismaClient = jest.fn().mockImplementation(function (this: {
    $connect: jest.Mock;
    $disconnect: jest.Mock;
  }) {
    this.$connect = jest.fn().mockResolvedValue(undefined);
    this.$disconnect = jest.fn().mockResolvedValue(undefined);
  });
  return { PrismaClient: MockPrismaClient };
});

describe('PrismaService', () => {
  let module: TestingModule;
  let service: PrismaService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('onApplicationShutdown で $disconnect が呼ばれる', async () => {
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();
    await service.onApplicationShutdown();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  // SIGTERM 受信時に NestJS が実行するのと同じ経路。フックの結線が外れたら
  // ここで気づける（Windows では SIGTERM 自体を送れないため、この形で固定する）。
  it('app.close() で onApplicationShutdown が呼ばれる', async () => {
    const app = module.createNestApplication();
    app.enableShutdownHooks();
    await app.init();

    const spy = jest.spyOn(app.get(PrismaService), 'onApplicationShutdown');
    await app.close();

    expect(spy).toHaveBeenCalled();
  });
});
