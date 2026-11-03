import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';

const contextOf = (): ExecutionContext =>
  ({
    getHandler: () => 'h',
    getClass: () => 'c',
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles: ['admin'] } }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();
    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  // 素通しに戻すと、admin 専用のつもりのエンドポイントが誰にでも開く。
  // 「書き忘れ」が実行時に何も起こさない状態に戻らないよう固定する。
  it('@Roles が無ければ 403 にする（素通ししない）', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(() => guard.canActivate(contextOf())).toThrow(ForbiddenException);
  });

  it('@Roles が空配列でも 403 にする', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(() => guard.canActivate(contextOf())).toThrow(ForbiddenException);
  });
});
