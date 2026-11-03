import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_ANONYMOUS_KEY } from '../decorators/allow-anonymous.decorator';
import { ConditionalAuthGuard } from './conditional-auth.guard';

/** getAllAndOverride は [handler, class] の順に見るので、両方を渡せる形にする */
const contextOf = (handler: unknown, cls: unknown): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }) as unknown as ExecutionContext;

describe('ConditionalAuthGuard', () => {
  let guard: ConditionalAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    // AUTH_ENABLED=false にして内側を MockAuthGuard にしておく。
    // ここで見たいのは「委譲するかどうか」で、JWT 検証そのものではない。
    process.env.AUTH_ENABLED = 'false';
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConditionalAuthGuard, Reflector],
    }).compile();
    guard = module.get(ConditionalAuthGuard);
    reflector = module.get(Reflector);
  });

  it('ハンドラーに @AllowAnonymous() があれば内側のガードを呼ばずに通す', () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(true);
    const inner = jest.spyOn(
      (guard as unknown as { guard: { canActivate: () => boolean } }).guard,
      'canActivate',
    );

    expect(guard.canActivate(contextOf('h', 'c'))).toBe(true);
    expect(spy).toHaveBeenCalledWith(IS_ANONYMOUS_KEY, ['h', 'c']);
    expect(inner).not.toHaveBeenCalled();
  });

  it('@AllowAnonymous() が無ければ内側のガードに委譲する', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const inner = jest
      .spyOn(
        (guard as unknown as { guard: { canActivate: () => boolean } }).guard,
        'canActivate',
      )
      .mockReturnValue(true);

    expect(guard.canActivate(contextOf('h', 'c'))).toBe(true);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  // クラスに付ければコントローラー全体が認証不要になる、を固定する
  it('クラスレベルの @AllowAnonymous() でも通す', () => {
    class AnonymousController {}
    Reflect.defineMetadata(IS_ANONYMOUS_KEY, true, AnonymousController);
    const inner = jest.spyOn(
      (guard as unknown as { guard: { canActivate: () => boolean } }).guard,
      'canActivate',
    );

    const handler = () => undefined;
    expect(guard.canActivate(contextOf(handler, AnonymousController))).toBe(
      true,
    );
    expect(inner).not.toHaveBeenCalled();
  });
});
