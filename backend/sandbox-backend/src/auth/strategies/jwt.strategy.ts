import { ForbiddenException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: Record<string, unknown>): Promise<AuthenticatedUser> {
    const sub = payload['sub'] as string;

    const user = await this.prisma.user.findUnique({
      where: { externalId: sub },
      select: { id: true, roles: { select: { role: true } } },
    });

    // IdP で認証できてもアプリに登録されていなければ利用させない
    if (!user) {
      throw new ForbiddenException('ユーザーが登録されていません');
    }

    return {
      id: user.id,
      sub,
      name: payload['name'] as string | undefined,
      email: payload['email'] as string | undefined,
      // JWT のロールは発行時点のスナップショットなので使わない。
      // DB を見ることで、ロール変更が次のリクエストから即座に効く。
      roles: user.roles.map((r) => r.role),
    };
  }
}
