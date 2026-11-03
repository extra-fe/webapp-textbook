import { createZodDto } from 'nestjs-zod';
import { UpdateRolesSchema, type UpdateRolesInput } from '../admin-validation';

export class UpdateRolesDto extends createZodDto(UpdateRolesSchema) {}
export interface UpdateRolesDto extends UpdateRolesInput {}
