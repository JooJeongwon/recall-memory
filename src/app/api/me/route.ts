import { endpoint, json } from "@/lib/server/http";
import { rpc } from "@/lib/server/photos";

export const runtime = "nodejs";
export const GET = endpoint(async () => {
  return json(await rpc("me_state", {}));
}, "/api/me");

export const DELETE = endpoint(async () => json(await deleteAccount(), 202), "/api/me");
import { deleteAccount } from "@/lib/server/deletions";
