import { Module } from '@nestjs/common';
import { RoleCacheModule } from '../common/cache/role-cache.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  // AuthModule と同じ CACHE_MANAGER を参照する必要があるため、
  // CacheModule を直接 register せず RoleCacheModule を import する
  imports: [RoleCacheModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}
