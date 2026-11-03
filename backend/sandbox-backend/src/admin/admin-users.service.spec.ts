import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUsersService } from './admin-users.service';

const CURRENT_USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

const mockUser = {
  id: OTHER_USER_ID,
  externalId: 'keycloak-sub-of-other-user',
};

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    userRole: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(AdminUsersService);
  });

  // if (id === currentUserId) の1行はリファクタリングのついでに消えても
  // 誰も気付かない種類のコード。ここで恒久的に固定する。
  it('自分自身のIDを指定すると ForbiddenException を投げる', async () => {
    await expect(
      service.updateRoles(
        CURRENT_USER_ID,
        { roles: ['operator'] },
        CURRENT_USER_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // DB にもキャッシュにも触っていないこと
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('他ユーザーのロールを正常に更新できる', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...mockUser,
      roles: [{ role: 'operator' }],
    });

    await service.updateRoles(
      OTHER_USER_ID,
      { roles: ['operator'] },
      CURRENT_USER_ID,
    );

    // ロール更新が通ったかだけでは、キャッシュ無効化を落とした変更を見逃す
    expect(cache.del).toHaveBeenCalledWith(`rbac:${mockUser.externalId}`);
  });

  it('存在しないユーザーなら UnprocessableEntityException を投げる', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.updateRoles(OTHER_USER_ID, { roles: [] }, CURRENT_USER_ID),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
