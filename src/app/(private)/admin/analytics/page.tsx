import { isAnalyticsAdmin } from "@/lib/server/analytics";
import { requireUser } from "@/lib/server/auth";
import { AnalyticsDashboard } from "./dashboard";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await requireUser();
  if (!isAnalyticsAdmin(user)) return <><h1>통계 접근 권한이 없어요.</h1><p>관리자로 지정된 Google 계정으로 로그인해주세요.</p></>;
  return <AnalyticsDashboard />;
}
