import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Cache } from 'cache-manager';
import { passportJwtSecret } from 'jwks-rsa';
import { getRoleCacheTtlMs } from '../../common/cache/role-cache.module';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IDP_PROVIDER_TOKEN,
  type IdpClaims,
  type IIdpProvider,
} from '../idp/idp-provider.interface';
import { AuthenticatedUser } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(IDP_PROVIDER_TOKEN) private readonly idp: IIdpProvider,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    const audience = idp.getAudience();
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        // kid ベースの LRU キャッシュ。キーローテーション時は新 kid で
        // キャッシュミスが発生し、JWKS エンドポイントから自動で新鍵を取得する。
        cacheMaxAge: 10 * 60 * 1000, // 10分（デフォルト値を明示）
        cacheMaxEntries: 5,
        rateLimit: true,
        jwksRequestsPerMinute: 10, // デフォルト値を明示
        jwksUri: idp.getJwksUri(),
        timeout: 5000,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: idp.getIssuer(),
      // audience は未設定なら渡さない（渡すと必ず検証される）
      ...(audience ? { audience } : {}),
      algorithms: ['RS256'],
      // 既定で false。exp クレームは passport-jwt が自動検証する。
      // true にすると期限切れトークンが通るため、意図として明示しておく。
      ignoreExpiration: false,
    });
  }

  async validate(payload: Record<string, unknown>): Promise<AuthenticatedUser> {
    // IdP 固有のクレーム解釈はプロバイダーに任せる
    const claims = this.idp.mapClaims(payload);
    const cacheKey = `rbac:${claims.sub}`;

    // キャッシュヒットなら DB を引かない
    const cached = await this.cache.get<AuthenticatedUser>(cacheKey);
    if (cached) return cached;

    return this.fetchAndCache(cacheKey, claims);
  }

  private async fetchAndCache(
    cacheKey: string,
    claims: IdpClaims,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { externalId: claims.sub },
      select: { id: true, roles: { select: { role: true } } },
    });

    // IdP で認証できてもアプリに登録されていなければ利用させない
    if (!user) {
      throw new ForbiddenException('ユーザーが登録されていません');
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      sub: claims.sub,
      name: claims.name,
      email: claims.email,
      // JWT のロールは発行時点のスナップショットなので使わない。
      // DB を見ることで、ロール変更が次のリクエストから即座に効く。
      roles: user.roles.map((r) => r.role),
    };
    await this.cache.set(cacheKey, authUser, getRoleCacheTtlMs());
    return authUser;
  }
}
