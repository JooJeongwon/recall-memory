import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./http";
import type { Database } from "@/types/database";

export function adminClient() {
  const key = process.env.SUPABASE_SERVER_SECRET_KEY;
  if (!key) throw new ApiError(503, "NOT_CONFIGURED");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
