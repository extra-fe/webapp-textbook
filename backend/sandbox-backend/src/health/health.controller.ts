import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AllowAnonymous } from '../auth/decorators/allow-anonymous.decorator';

// ロードバランサーが秒単位で叩くため、制限に引っかかると
// 「インスタンス異常」と判断されてしまう
@SkipThrottle({ default: true })
@Controller('api/health')
export class HealthController {
  // ロードバランサーが叩くため認証不要。意図を残す
  @Get()
  @AllowAnonymous()
  checkHealth() {
    return { status: 'ok' };
  }
}
