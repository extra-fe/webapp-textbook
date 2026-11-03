import { SetMetadata } from '@nestjs/common';

/** 認証不要のエンドポイントに付与するデコレーター。HTTP デコレーターの直後に記述すること。 */
export const AllowAnonymous = () => SetMetadata('isAnonymous', true);
