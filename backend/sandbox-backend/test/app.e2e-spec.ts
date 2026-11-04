import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SystemClock } from '../src/common/clock/clock';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

/**
 * main.ts と同じ順で組み立てる。
 * Test.createTestingModule が組むのは AppModule だけで main.ts は走らないため、
 * ここで載せ直さないと「本番と違うもの」をテストすることになる（本文7.5節）。
 */
const createApp = async (): Promise<INestApplication<App>> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();

  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));

  app.use(helmet({ hsts: false }));
  app.disable('x-powered-by');

  app.useGlobalPipes(new ZodValidationPipe());
  const clock = new SystemClock();
  app.useGlobalFilters(
    new GlobalExceptionFilter(clock),
    new PrismaExceptionFilter(clock),
  );

  await app.init();
  return app;
};

/** 4.12節の統一エラーレスポンス */
interface ErrorBody {
  statusCode: number;
  code: string;
  requestId: string;
}
const bodyOf = (res: { body: unknown }) => res.body as ErrorBody;

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // 4.1節：X-Request-Id がどのリクエストにも付くこと
  describe('X-Request-Id (4.1節)', () => {
    it.each([
      ['/', 'ルート'],
      ['/api/health', '1階層'],
      ['/api/guest/announcements', '2階層'],
    ])('%s（%s）にヘッダが付く', async (path) => {
      const res = await request(app.getHttpServer()).get(path);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    // AppModule.configure() の forRoutes('{*splat}') が効いているか。
    // '*' のままだと部分指定で取りこぼす（本文4.1節）
    it('ルーティングにマッチしないパスでも実行される', async () => {
      const res = await request(app.getHttpServer()).get('/no-such-path');
      expect(res.status).toBe(404);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(bodyOf(res).requestId).toBe(res.headers['x-request-id']);
    });

    // パーサー層のエラー。AppModule.configure() の登録はボディパーサーより
    // 後ろに積まれるので、main.ts 側の app.use() が無いとここで ID が落ちる
    // ボディのサイズ上限を超えたときのエラー。body-parser が投げるものは
    // HttpException ではないが status を持つので 413 のまま返る。
    // requestId が載ることが要点で、問い合わせで一番 ID が欲しい場面。
    it('413 でも requestId がボディに載り、ヘッダと一致する', async () => {
      const huge = 'x'.repeat(200 * 1024); // Express の既定上限は 100kb
      const res = await request(app.getHttpServer())
        .post('/api/races')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ name: huge }));

      expect(res.status).toBe(413);
      expect(bodyOf(res).code).toBe('PAYLOAD_TOO_LARGE');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(bodyOf(res).requestId).toBe(res.headers['x-request-id']);
    });
  });

  // 5.6節：素性を隠す
  describe('セキュリティヘッダー (5.6節)', () => {
    it('X-Powered-By が付かない', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('helmet の既定ヘッダが付く', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toContain(
        "script-src 'self'",
      );
    });

    it('開発時は HSTS を付けない', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.headers['strict-transport-security']).toBeUndefined();
    });
  });
});

// 4.4節：X-Forwarded-For を変えても同じカウントに入ること
describe('スロットリング (4.4節)', () => {
  let app: INestApplication<App>;
  const ORIGINAL = process.env.THROTTLE_DEFAULT_LIMIT;

  beforeAll(async () => {
    // resolveThrottlerOptions はモジュール生成時に読むので、先に設定する
    process.env.THROTTLE_DEFAULT_LIMIT = '2';
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    if (ORIGINAL === undefined) delete process.env.THROTTLE_DEFAULT_LIMIT;
    else process.env.THROTTLE_DEFAULT_LIMIT = ORIGINAL;
  });

  // trust proxy を有効にすると、ここが 8 回とも 200 になって回避が成立する
  it('リクエストごとに違う X-Forwarded-For を送っても3回目が429になる', async () => {
    const get = (ip: string) =>
      request(app.getHttpServer())
        .get('/api/guest/announcements')
        .set('X-Forwarded-For', ip);

    expect((await get('203.0.113.1')).status).toBe(200);
    expect((await get('203.0.113.2')).status).toBe(200);
    expect((await get('203.0.113.3')).status).toBe(429);
  });
});

// 5.7節：認証はアプリ全体の既定。@UseGuards を書いていなくても閉じている
describe('認証の既定 (5.7節)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // ConditionalAuthGuard はコンストラクタで AUTH_ENABLED を読む
    process.env.AUTH_ENABLED = 'true';
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    process.env.AUTH_ENABLED = 'false'; // setup-env.ts の既定に戻す
  });

  // /auth/me は 5.7節で @UseGuards を丸ごと外した。それでも閉じている
  it('@UseGuards を書いていないエンドポイントも401を返す', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('@AllowAnonymous() を付けたエンドポイントは通る', async () => {
    expect((await request(app.getHttpServer()).get('/')).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/api/health')).status).toBe(
      200,
    );
    expect(
      (await request(app.getHttpServer()).get('/api/guest/announcements'))
        .status,
    ).toBe(200);
  });

  it('@Roles を要求するエンドポイントもトークン無しでは401', async () => {
    expect((await request(app.getHttpServer()).get('/api/races')).status).toBe(
      401,
    );
    expect(
      (await request(app.getHttpServer()).get('/api/admin/users')).status,
    ).toBe(401);
  });
});
