import { endpoint, json } from "@/lib/server/http";
import { rpc } from "@/lib/server/photos";
import { requireUser } from "@/lib/server/auth";
import { isAnalyticsAdmin } from "@/lib/server/analytics";

export const runtime = "nodejs";
export const GET = endpoint(async () => {
  const auth = await requireUser();
  const me = await rpc("me_state", {}, auth);
  return json({ ...me as Record<string, unknown>, can_view_analytics: isAnalyticsAdmin(auth.user) });
}, "/api/me");

export const DELETE = endpoint(async () => json(await deleteAccount(), 202), "/api/me");
import { deleteAccount } from "@/lib/server/deletions";
