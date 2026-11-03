import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from './auth/decorators/allow-anonymous.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // 疎通確認用のトップ。認証不要であることを明示する
  @Get()
  @AllowAnonymous()
  getHello(): string {
    return this.appService.getHello();
  }
}
