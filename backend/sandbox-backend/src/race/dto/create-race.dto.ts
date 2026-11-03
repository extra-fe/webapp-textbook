import { createZodDto } from 'nestjs-zod';
import {
  CreateRaceSchema,
  type CreateRaceInput,
} from '../../../../../shared/src/race-validation';

export class CreateRaceDto extends createZodDto(CreateRaceSchema) {}
// createZodDto が返すクラスのプロパティ型を Zod の推論結果で上書きする
export interface CreateRaceDto extends CreateRaceInput {}
