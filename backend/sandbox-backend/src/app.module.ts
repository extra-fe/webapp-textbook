import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnnouncementModule } from './announcement/announcement.module';
import { AuthModule } from './auth/auth.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RaceModule } from './race/race.module';

@Module({
  imports: [PrismaModule, AuthModule, RaceModule, AnnouncementModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5（path-to-regexp v8）は無名ワイルドカード '*' を廃止したため、
    // 名前付きワイルドカード '{*splat}' を使う。'splat' は任意の名前。
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}
