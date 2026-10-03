import 'dotenv/config';
import { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { SystemClock } from './common/clock/clock';
import { resolveCorsConfig } from './common/cors/cors-config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

const bootstrapLogger = new JsonLoggerService(
  (process.env.LOG_LEVEL ?? 'error') as LogLevel,
);

process.on('unhandledRejection', (reason: unknown) => {
  bootstrapLogger.error(
    reason instanceof Error ? reason.message : String(reason),
    reason instanceof Error ? reason.stack : undefined,
    'unhandledRejection',
  );
});

process.on('uncaughtException', (error: Error) => {
  bootstrapLogger.error(error.message, error.stack, 'uncaughtException');
  process.exit(1); // uncaughtExceptionはプロセスを終了させる
});

async function bootstrap() {
  const logLevel = (process.env.LOG_LEVEL ?? 'error') as LogLevel;
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLoggerService(logLevel),
  });
  app.enableShutdownHooks(); // SIGTERM で onApplicationShutdown を呼ばせる

  // AppModule.configure() の登録はボディパーサーより後ろに積まれるため、
  // パーサー層で起きたエラーのレスポンスに X-Request-Id が付かない。
  // 問い合わせで一番 ID が欲しい場面なので、ここでも通しておく。
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));

  app.useGlobalPipes(new ZodValidationPipe());

  // 登録順が結果を変える。NestJS は配列を反転してから先頭一致で探すため、
  // 後に登録したフィルターほど先に評価される。だから「汎用 → 具体」に並べる。
  const clock = new SystemClock();
  app.useGlobalFilters(
    new GlobalExceptionFilter(clock), // 汎用：あらゆる例外を統一フォーマットへ
    new PrismaExceptionFilter(clock), // 具体的：Prisma エラーを処理
  );

  const corsConfig = resolveCorsConfig(
    process.env.CORS_ORIGIN,
    process.env.CORS_METHODS,
  );
  if (corsConfig.enabled) {
    app.enableCors({
      origin: corsConfig.origin,
      methods: corsConfig.methods,
      credentials: true,
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Sandbox API')
      .setDescription('sandbox-backend REST API 一覧')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap().catch((e: unknown) => {
  // 起動に失敗したら異常終了させる。unhandledRejection はログだけ出して継続する
  // 方針なので、ここで catch しないと CORS の設定ミスのような致命的な起動エラーでも
  // 終了コードが 0 になり、コンテナ基盤が異常と判断できない。
  bootstrapLogger.error(
    e instanceof Error ? e.message : String(e),
    e instanceof Error ? e.stack : undefined,
    'bootstrap',
  );
  process.exit(1);
});
