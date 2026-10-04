import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { RoleCacheModule } from '../common/cache/role-cache.module';
import { AuthController } from './auth.controller';
import { IDP_PROVIDER_TOKEN } from './idp/idp-provider.interface';
import { KeycloakIdpProvider } from './idp/keycloak.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, RoleCacheModule],
  controllers: [AuthController],
  providers: [
    // IdP を差し替えるときはこの useClass だけを変える
    { provide: IDP_PROVIDER_TOKEN, useClass: KeycloakIdpProvider },
    JwtStrategy,
  ],
  exports: [IDP_PROVIDER_TOKEN],
})
export class AuthModule {}
