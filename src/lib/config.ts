// DB의 public.app_policy()와 함께 변경하는 고정 MVP 제한입니다.
export const policy = {
  bucket: "memory-assets",
  trialHours: 48,
  firstNoteHours: 24,
  secondNoteHours: 48,
  maxPhotos: 20,
  maxBatch: 10,
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
  noteLength: 500,
  reservationHours: 24,
} as const;

export const formats = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVER_SECRET_KEY);
}
