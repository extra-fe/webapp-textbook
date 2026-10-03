/** IdP のクレームから取り出した、IdP 非依存のユーザー情報 */
export interface IdpClaims {
  sub: string;
  email?: string;
  name?: string;
}

export interface IIdpProvider {
  /** 公開鍵を取得する JWKS エンドポイント */
  getJwksUri(): string;
  /** 期待する発行者（iss） */
  getIssuer(): string;
  /** 期待するオーディエンス（aud）。検証しない場合は undefined */
  getAudience(): string | undefined;
  /** IdP 固有のペイロードを共通の形に変換する */
  mapClaims(payload: Record<string, unknown>): IdpClaims;
}

export const IDP_PROVIDER_TOKEN = 'IDP_PROVIDER_TOKEN';
