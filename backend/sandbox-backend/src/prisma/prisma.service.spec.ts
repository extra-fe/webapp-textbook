import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService のシャットダウンフック', () => {
  // SIGTERM 受信時に NestJS が実行するのと同じ経路。フックの結線が外れたら
  // ここで気づける（Windows では SIGTERM 自体を送れないため、この形で固定する）。
  it('app.close() で onApplicationShutdown が呼ばれる', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.enableShutdownHooks();
    await app.init();

    const prisma = app.get(PrismaService);
    const shutdownSpy = jest.spyOn(prisma, 'onApplicationShutdown');

    await app.close();

    expect(shutdownSpy).toHaveBeenCalled();
  });
});
