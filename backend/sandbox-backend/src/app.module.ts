import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnnouncementModule } from './announcement/announcement.module';
import { AuthModule } from './auth/auth.module';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { EnvSource, validateEnv } from './common/env/env-validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { resolveThrottlerOptions } from './common/throttle/throttler-options';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RaceModule } from './race/race.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      // 全モジュールから ConfigService を注入できるようにする
      isGlobal: true,
      // モジュール初期化時に走らせることで、main.ts を経由しない起動経路
      // （e2e の Test.createTestingModule や OpenAPI 生成スクリプト）でも
      // 同じ検証が効く。validate は設定オブジェクトを返す契約なのでそのまま返す。
      validate: (config: Record<string, unknown>) => {
        validateEnv(config as EnvSource);
        return config;
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: resolveThrottlerOptions, // 通常エンドポイント: 1分に100リクエスト
    }),
    PrismaModule,
    AuthModule,
    RaceModule,
    AnnouncementModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5（path-to-regexp v8）は無名ワイルドカード '*' を廃止したため、
    // 名前付きワイルドカード '{*splat}' を使う。'splat' は任意の名前。
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}
