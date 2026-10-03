import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// ロードバランサーが秒単位で叩くため、制限に引っかかると
// 「インスタンス異常」と判断されてしまう
@SkipThrottle({ default: true })
@Controller('api/health')
export class HealthController {
  @Get()
  checkHealth() {
    return { status: 'ok' };
  }
}
