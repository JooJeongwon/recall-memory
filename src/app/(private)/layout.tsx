import { isConfigured } from "@/lib/config";
import { pageUser } from "@/lib/server/auth";
import { ConnectionNotice } from "@/components/connection-notice";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured()) return <><ConnectionNotice />{children}</>;
  await pageUser();
  return children;
}
