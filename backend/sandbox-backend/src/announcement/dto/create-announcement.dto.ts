import { createZodDto } from 'nestjs-zod';
import {
  CreateAnnouncementSchema,
  type CreateAnnouncementInput,
} from '../announcement-validation';

export class CreateAnnouncementDto extends createZodDto(
  CreateAnnouncementSchema,
) {}
export interface CreateAnnouncementDto extends CreateAnnouncementInput {}
