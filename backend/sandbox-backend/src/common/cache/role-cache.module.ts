import { CacheModule, type CacheModuleOptions } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { KeyvCacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

export const ROLE_CACHE_LRU_SIZE = 1000;

export function getRoleCacheTtlMs(): number {
  return Number(process.env.ROLE_CACHE_TTL_SEC ?? 30) * 1000;
}

/**
 * RBAC キャッシュ。AuthModule（書く側）と AdminModule（消す側）が
 * 同じ CACHE_MANAGER インスタンスを参照する必要があるため、
 * それぞれで CacheModule.register() せずこのモジュールを import する。
 */
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: (): CacheModuleOptions => ({
        stores: [
          new Keyv({
            store: new KeyvCacheableMemory({
              ttl: getRoleCacheTtlMs(),
              // 上限が無いと認証ユーザーぶんだけヒープが単調に増える。
              // CacheModule.registerAsync のトップレベル max は
              // cache-manager v7（Keyv ベース）では黙って無視される。
              lruSize: ROLE_CACHE_LRU_SIZE,
            }),
          }),
        ],
      }),
    }),
  ],
  exports: [CacheModule],
})
export class RoleCacheModule {}
