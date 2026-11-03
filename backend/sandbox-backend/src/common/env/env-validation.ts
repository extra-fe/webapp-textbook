import { validateIdpConfig } from '../auth/idp-config';

/**
 * 検証対象の環境変数ソース。
 *
 * ConfigModule.forRoot() の validate は `.env` を読み込んだ結果と process.env を
 * マージしたオブジェクトを渡してくるが、この時点では `.env` 由来の値はまだ
 * process.env に反映されていない（@nestjs/config は validate の戻り値を
 * 受け取ってから process.env へ反映する）。そのため検証は process.env ではなく
 * 渡されたオブジェクトに対して行う必要がある。
 */
export type EnvSource = Record<string, string | undefined>;

export function validateEnv(env: EnvSource = process.env): void {
  const missing: string[] = [];

  // どの構成でも必須のもの
  if (!env.DATABASE_URL) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  // IdP 固有の検証は別ファイルに分けてある（IdP を差し替えるとここだけ変わる）
  validateIdpConfig(env);
}
