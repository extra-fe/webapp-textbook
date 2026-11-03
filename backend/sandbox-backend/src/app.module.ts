import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AnnouncementModule } from './announcement/announcement.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RaceModule } from './race/race.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { resolveThrottlerOptions } from './common/throttle/throttler-options';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      // 全モジュールから ConfigService を注入できるようにする
      isGlobal: true,
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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5（path-to-regexp v8）は無名ワイルドカード '*' を廃止したため、
    // 名前付きワイルドカード '{*splat}' を使う。'splat' は任意の名前。
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}
