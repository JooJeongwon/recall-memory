import { z } from "zod";
import { formats, policy } from "../config";

export const uuid = z.uuid();
export const noteInput = z.object({
  note_stage: z.enum(["first", "second"]),
  note_text: z.string().transform((value) => value.trim())
    .refine((value) => [...value].length <= policy.noteLength, "메모는 500자까지 남길 수 있어요."),
  expected_version: z.number().int().positive(),
  request_id: uuid,
}).strict();
export const uploadInput = z.object({
  files: z.array(z.object({
    original_name: z.string().min(1).max(255).refine((s) => !/[\x00-\x1f]/.test(s)),
    mime_type: z.enum(Object.keys(formats) as [keyof typeof formats, ...Array<keyof typeof formats>]),
    byte_size: z.number().int().positive().max(policy.maxBytes),
    client_request_id: uuid,
  }).strict()).min(1).max(policy.maxBatch)
    .refine((files) => new Set(files.map((f) => f.client_request_id)).size === files.length),
}).strict();
export const preferencesInput = z.object({
  analytics_consent: z.boolean(),
  timezone: z.string().max(100).refine((zone) => {
    try { new Intl.DateTimeFormat("ko", { timeZone: zone }); return true; }
    catch { return false; }
  }),
}).strict();
export const eventInput = z.object({
  name: z.enum(["photo_viewed", "memory_opened", "export_generated"]),
  photo_id: uuid,
  client_event_id: uuid,
  visit_context: z.enum(["organic", "prompted", "unknown"]).default("unknown"),
}).strict();

// API 응답 계약입니다. DB 타입은 db:types로 실제 스키마에서 생성합니다.
export const photoSchema = z.object({
  id: uuid, note_text: z.string(), second_note_text: z.string(), second_note_at: z.string().nullable(), version: z.number(),
  original_name: z.string(), mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byte_size: z.number(), ready_at: z.string(), preserved_at: z.string().nullable(),
  first_note_at: z.string().nullable(), first_viewed_at: z.string().nullable(),
});
export type Photo = z.infer<typeof photoSchema>;
export const photoColumns = "id,note_text,second_note_text,second_note_at,version,original_name,mime_type,byte_size,ready_at,preserved_at,first_note_at,first_viewed_at";
