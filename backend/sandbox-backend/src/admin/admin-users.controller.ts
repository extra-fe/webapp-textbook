import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types';
import { AdminUsersService } from './admin-users.service';
import { UpdateRolesDto } from './dto/update-roles.dto';

@ApiTags('admin/users')
@ApiBearerAuth('access-token')
@Controller('api/admin/users')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // 差分更新ではなくロールの全置換なので PATCH ではなく PUT
  @Put(':id/roles')
  @ApiResponse({ status: 403, description: '自分自身のロールは変更できない' })
  @ApiResponse({ status: 422, description: '指定IDのユーザーが存在しない' })
  updateRoles(
    @Param('id') id: string,
    @Body() dto: UpdateRolesDto,
    // 操作対象の :id と突き合わせるために操作者本人を受け取る
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.updateRoles(id, dto, currentUser.id);
  }
}
