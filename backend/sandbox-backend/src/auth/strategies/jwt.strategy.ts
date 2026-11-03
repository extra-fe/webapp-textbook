import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IDP_PROVIDER_TOKEN,
  type IIdpProvider,
} from '../idp/idp-provider.interface';
import { AuthenticatedUser } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(IDP_PROVIDER_TOKEN) private readonly idp: IIdpProvider,
    private readonly prisma: PrismaService,
  ) {
    const audience = idp.getAudience();
    super({
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: idp.getJwksUri(),
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

    const user = await this.prisma.user.findUnique({
      where: { externalId: claims.sub },
      select: { id: true, roles: { select: { role: true } } },
    });

    // IdP で認証できてもアプリに登録されていなければ利用させない
    if (!user) {
      throw new ForbiddenException('ユーザーが登録されていません');
    }

    return {
      id: user.id,
      sub: claims.sub,
      name: claims.name,
      email: claims.email,
      // JWT のロールは発行時点のスナップショットなので使わない。
      // DB を見ることで、ロール変更が次のリクエストから即座に効く。
      roles: user.roles.map((r) => r.role),
    };
  }
}
