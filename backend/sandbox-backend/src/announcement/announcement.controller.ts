import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '../auth/decorators/allow-anonymous.decorator';
import { AnnouncementService } from './announcement.service';

/**
 * 認証不要のお知らせ API。
 * ログイン画面でも表示するため、あえてガードを付けていない。
 * パスに guest を含めることで「認証不要である」ことを明示する。
 */
@ApiTags('announcements')
@Controller('api/guest/announcements')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({ summary: '掲載中のお知らせ一覧（認証不要）' })
  findActive() {
    return this.announcementService.findActive();
  }
}
