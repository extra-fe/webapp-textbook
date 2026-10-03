import { Injectable } from '@nestjs/common';
import type { IdpClaims, IIdpProvider } from './idp-provider.interface';

@Injectable()
export class KeycloakIdpProvider implements IIdpProvider {
  private readonly url = process.env.KEYCLOAK_URL as string;
  private readonly realm = process.env.KEYCLOAK_REALM as string;

  getJwksUri(): string {
    return `${this.url}/realms/${this.realm}/protocol/openid-connect/certs`;
  }

  getIssuer(): string {
    return `${this.url}/realms/${this.realm}`;
  }

  getAudience(): string | undefined {
    return process.env.KEYCLOAK_AUDIENCE || undefined;
  }

  mapClaims(payload: Record<string, unknown>): IdpClaims {
    return {
      sub: payload['sub'] as string,
      email: payload['email'] as string | undefined,
      name: payload['name'] as string | undefined,
    };
  }
}
