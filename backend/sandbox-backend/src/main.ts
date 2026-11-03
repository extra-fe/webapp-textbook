import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { resolveCorsConfig } from './common/cors/cors-config';
import { AppModule } from './app.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // AppModule.configure() の登録はボディパーサーより後ろに積まれるため、
  // パーサー層で起きたエラーのレスポンスに X-Request-Id が付かない。
  // 問い合わせで一番 ID が欲しい場面なので、ここでも通しておく。
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.useGlobalPipes(new ZodValidationPipe());

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

  app.enableShutdownHooks(); // SIGTERM で onApplicationShutdown を呼ばせる
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
