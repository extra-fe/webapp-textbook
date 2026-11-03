import { createZodDto } from 'nestjs-zod';
import {
  UpdateRaceSchema,
  type UpdateRaceInput,
} from '../../../../../shared/src/race-validation';

export class UpdateRaceDto extends createZodDto(UpdateRaceSchema) {}
export interface UpdateRaceDto extends UpdateRaceInput {}
