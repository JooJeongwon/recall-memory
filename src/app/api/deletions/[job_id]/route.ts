import { endpoint, json } from "@/lib/server/http";
import { deletionStatus } from "@/lib/server/deletions";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ job_id: string }> }) {
  const { job_id } = await context.params;
  return endpoint(async (request) => {
    return json(await deletionStatus(request, job_id));
  }, "/api/deletions/[job_id]")(request);
}
