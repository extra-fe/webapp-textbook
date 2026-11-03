import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AllowAnonymous } from '../auth/decorators/allow-anonymous.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

/**
 * 認証不要の /api/guest/announcements と admin 限定の
 * /api/admin/announcements が同居するため、ガードはクラスレベルではなく
 * メソッド単位に付ける。クラスに付けると @AllowAnonymous() を書いても
 * ガードは動き、ログイン前の画面からお知らせが取れなくなる。
 *
 * @Controller() に接頭辞を置いていないのも、/api/guest/... と
 * /api/admin/... を1つの接頭辞で表せないため。
 */
@ApiTags('announcements')
@Controller()
export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  // 認証不要。ログイン画面で使う（3.7節）
  @Get('api/guest/announcements')
  @AllowAnonymous()
  @ApiOperation({ summary: '掲載中のお知らせ一覧（認証不要）' })
  findActive() {
    return this.service.findActive();
  }

  // ここから下は admin 限定
  @Get('api/admin/announcements')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'お知らせ全件取得（管理者）' })
  findAll() {
    return this.service.findAll();
  }

  @Post('api/admin/announcements')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'お知らせ作成（管理者）' })
  create(@Body() dto: CreateAnnouncementDto) {
    return this.service.create(dto);
  }

  @Patch('api/admin/announcements/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'お知らせ更新（管理者）' })
  @ApiResponse({ status: 422, description: 'お知らせが存在しない' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateAnnouncementDto>) {
    return this.service.update(id, dto);
  }

  @Delete('api/admin/announcements/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @HttpCode(204)
  @ApiOperation({ summary: 'お知らせ削除（管理者）' })
  @ApiResponse({ status: 422, description: 'お知らせが存在しない' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
