import { endpoint, json } from "@/lib/server/http";
import { rpc } from "@/lib/server/photos";

import { requireUser } from "@/lib/server/auth";
import { isAnalyticsAdmin } from "@/lib/server/analytics";

export const runtime = "nodejs";
export const GET = endpoint(async () => {
  const { user } = await requireUser();
  const me = await rpc("me_state", {});
  return json({ ...me as Record<string, unknown>, can_view_analytics: isAnalyticsAdmin(user) });
});

export const DELETE = endpoint(async () => json(await deleteAccount(), 202));
import { deleteAccount } from "@/lib/server/deletions";
