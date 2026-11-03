import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import {
  ROLE_CACHE_LRU_SIZE,
  RoleCacheModule,
  getRoleCacheTtlMs,
} from './role-cache.module';

/** AuthModule（書く側）と AdminModule（消す側）に見立てた2つの利用者 */
@Injectable()
class Writer {
  constructor(@Inject(CACHE_MANAGER) readonly cache: Cache) {}
}

@Injectable()
class Deleter {
  constructor(@Inject(CACHE_MANAGER) readonly cache: Cache) {}
}

@Module({ imports: [RoleCacheModule], providers: [Writer], exports: [Writer] })
class WriterModule {}

@Module({
  imports: [RoleCacheModule],
  providers: [Deleter],
  exports: [Deleter],
})
class DeleterModule {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('RoleCacheModule', () => {
  const ORIGINAL_TTL = process.env.ROLE_CACHE_TTL_SEC;

  afterEach(() => {
    if (ORIGINAL_TTL === undefined) delete process.env.ROLE_CACHE_TTL_SEC;
    else process.env.ROLE_CACHE_TTL_SEC = ORIGINAL_TTL;
  });

  it('ROLE_CACHE_TTL_SEC が無ければ既定の30秒を使う', () => {
    delete process.env.ROLE_CACHE_TTL_SEC;
    expect(getRoleCacheTtlMs()).toBe(30 * 1000);

    process.env.ROLE_CACHE_TTL_SEC = '5';
    expect(getRoleCacheTtlMs()).toBe(5 * 1000);
  });

  it('lruSize を超えると古いものから追い出される', async () => {
    delete process.env.ROLE_CACHE_TTL_SEC;
    const module: TestingModule = await Test.createTestingModule({
      imports: [RoleCacheModule],
    }).compile();
    const cache = module.get<Cache>(CACHE_MANAGER);

    // 上限ちょうどまで埋めてから1つ足す
    for (let i = 0; i < ROLE_CACHE_LRU_SIZE; i++) {
      await cache.set(`rbac:user-${i}`, { id: `${i}` });
    }
    // ここで user-0 を読むと「最近使った」ことになる
    expect(await cache.get('rbac:user-0')).toBeTruthy();

    await cache.set('rbac:overflow', { id: 'overflow' });
    expect(await cache.get('rbac:overflow')).toBeTruthy();
    // 追い出されるのは最も長く使われていない user-1。直前に読んだ user-0 は残る
    expect(await cache.get('rbac:user-1')).toBeFalsy();
    expect(await cache.get('rbac:user-0')).toBeTruthy();

    await module.close();
  });

  it('TTL を過ぎたエントリは消える', async () => {
    // 秒で指定するので 0.05 秒 = 50ms。本物の経過を待つ
    process.env.ROLE_CACHE_TTL_SEC = '0.05';
    const module: TestingModule = await Test.createTestingModule({
      imports: [RoleCacheModule],
    }).compile();
    const cache = module.get<Cache>(CACHE_MANAGER);

    await cache.set('rbac:ttl', { id: 'x' });
    expect(await cache.get('rbac:ttl')).toBeTruthy();

    await sleep(150);
    expect(await cache.get('rbac:ttl')).toBeFalsy();

    await module.close();
  });

  // それぞれが CacheModule.register() を呼ぶと別々のストアができ、
  // 消したつもりのキャッシュが残る。同じインスタンスを見ていることを固定する。
  it('複数のモジュールから同じ CACHE_MANAGER を参照する', async () => {
    delete process.env.ROLE_CACHE_TTL_SEC;
    const module: TestingModule = await Test.createTestingModule({
      imports: [WriterModule, DeleterModule],
    }).compile();

    const writer = module.get(Writer);
    const deleter = module.get(Deleter);
    expect(writer.cache).toBe(deleter.cache);

    // 書いた側と消す側が同じストアを見ている
    await writer.cache.set('rbac:shared', { id: 'x' });
    expect(await deleter.cache.get('rbac:shared')).toBeTruthy();
    await deleter.cache.del('rbac:shared');
    expect(await writer.cache.get('rbac:shared')).toBeFalsy();

    await module.close();
  });
});
