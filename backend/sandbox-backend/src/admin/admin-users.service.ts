import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ForbiddenException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRolesDto } from './dto/update-roles.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        externalId: true,
        provider: true,
        email: true,
        name: true,
        roles: { select: { role: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRoles(id: string, dto: UpdateRolesDto, currentUserId: string) {
    // 自分自身のロールを変更すると管理者ロックアウトを引き起こしうるため禁止。
    // この1行が自己参照 IDOR の防御そのもの
    if (id === currentUserId) {
      throw new ForbiddenException('自分自身のロールは変更できません');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      // code は 4.13節の GlobalExceptionFilter が 422 から NOT_FOUND に
      // マッピングして付けるので、ここで明示する必要はない
      throw new UnprocessableEntityException(`User ${id} が見つかりません`);
    }

    // 全置換。途中で失敗して「ロールが空」の状態が残らないようトランザクションにする
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: dto.roles.map((role) => ({ userId: id, role })),
      }),
    ]);

    // ロール変更時はキャッシュを即時無効化する。
    // キーは users.id ではなく externalId（JWT の sub）であることに注意
    await this.cache.del(`rbac:${user.externalId}`);

    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        externalId: true,
        roles: { select: { role: true } },
      },
    });
  }
}
