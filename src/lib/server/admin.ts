import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./http";
import type { Database } from "@/types/database";

export function adminClient() {
  const key = process.env.SUPABASE_SERVER_SECRET_KEY;
  if (!key) throw new ApiError(503, "NOT_CONFIGURED");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return createClient<Database>(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
