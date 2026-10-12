import { endpoint, json, input } from "@/lib/server/http";
import { rpc } from "@/lib/server/photos";
import { preferencesInput } from "@/lib/validation/contracts";

export const runtime = "nodejs";
export const PATCH = endpoint(async (request) => {
  const preferences = await input(request, preferencesInput);
return json(await rpc("set_preferences", { p_consent: preferences.analytics_consent, p_timezone: preferences.timezone }));
}, "/api/me/preferences");
