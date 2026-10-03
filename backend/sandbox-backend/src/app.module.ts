import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnnouncementModule } from './announcement/announcement.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RaceModule } from './race/race.module';

@Module({
  imports: [PrismaModule, AuthModule, RaceModule, AnnouncementModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
