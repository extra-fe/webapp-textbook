import { z } from 'zod';

// ---- Entry ----

export const CreateEntrySchema = z.object({
  frameNumber: z.number().int().min(1).max(8),
  horseNumber: z.number().int().min(1),
  horseName: z.string().min(1).max(50),
  sex: z.string().max(4),
  age: z.string().max(8),
  weight: z.number().min(0).optional(),
  jockey: z.string().max(50),
  trainer: z.string().max(50),
  bodyWeight: z.string().max(20).optional(),
  oddsRank: z.number().int().min(1).optional(),
  odds: z.number().min(0).optional(),
  rank: z.number().int().min(1).optional(),
  time: z.string().max(20).optional(),
  margin: z.string().max(20).optional(),
});

/** API レスポンス用（id を含む）。PK は UUID なので文字列。 */
export const EntrySchema = CreateEntrySchema.extend({
  id: z.uuid(),
});

// ---- Race ----

export const CreateRaceSchema = z.object({
  /** UTC ISO8601 datetime 文字列 例: 1993-11-14T00:00:00.000Z */
  date: z.iso.datetime(),
  name: z.string().min(1).max(100),
  venue: z.string().min(1).max(50),
  entries: z.array(CreateEntrySchema),
});

export const UpdateRaceSchema = CreateRaceSchema.omit({ entries: true }).partial();

/** API レスポンス用（id を含む）。PK は UUID なので文字列。 */
export const RaceSchema = CreateRaceSchema.extend({
  id: z.uuid(),
  /** 楽観ロック用。更新時にこの値をそのまま送り返す。 */
  version: z.number().int(),
  entries: z.array(EntrySchema),
});

// ---- フォーム用スキーマ（HTML date input は YYYY-MM-DD を返すため専用スキーマを用意）----

export const CreateRaceFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で入力してください'),
  name: z.string().min(1, '必須項目です').max(100),
  venue: z.string().min(1, '必須項目です').max(50),
});

// ---- 型エクスポート ----

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;
export type CreateRaceInput = z.infer<typeof CreateRaceSchema>;
export type UpdateRaceInput = z.infer<typeof UpdateRaceSchema>;
export type CreateRaceFormValues = z.infer<typeof CreateRaceFormSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type Race = z.infer<typeof RaceSchema>;
