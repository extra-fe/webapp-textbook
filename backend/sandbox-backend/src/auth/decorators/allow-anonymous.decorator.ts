import { SetMetadata } from '@nestjs/common';

export const IS_ANONYMOUS_KEY = 'isAnonymous';

/** 認証不要のエンドポイントに付与する。付けないエンドポイントは既定で認証が必要。 */
export const AllowAnonymous = () => SetMetadata(IS_ANONYMOUS_KEY, true);
