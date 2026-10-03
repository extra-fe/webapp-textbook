import { EnvSource } from '../env/env-validation';

/**
 * 起動時に IdP の必須環境変数を検証する。
 *
 * AUTH_ENABLED=false のときはスキップする。「常に必須」にすると
 * 1.6節で用意した「Keycloak を起動せずに開発できる」状態が壊れる。
 *
 * IdP を差し替えるときはこの関数だけを書き換える。
 */
export function validateIdpConfig(env: EnvSource = process.env): void {
  if (env.AUTH_ENABLED === 'false') return;

  const missing = ['KEYCLOAK_URL', 'KEYCLOAK_REALM'].filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required IdP environment variables: ${missing.join(', ')}`,
    );
  }
}
