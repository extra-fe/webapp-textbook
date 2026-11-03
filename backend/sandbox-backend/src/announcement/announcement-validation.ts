import { z } from 'zod';

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  level: z.enum(['info', 'warning', 'error']).default('info').optional(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
