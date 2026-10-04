import { z } from 'zod';

export const RoleSchema = z.enum(['admin', 'operator', 'viewer']);
export const UpdateRolesSchema = z.object({
  // 差分ではなく全置換。空配列を渡せば全ロールを剥奪できる
  roles: z.array(RoleSchema),
});
export type UpdateRolesInput = z.infer<typeof UpdateRolesSchema>;
