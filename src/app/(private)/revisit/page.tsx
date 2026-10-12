import { Revisit } from "@/features/revisit/revisit";
import { TrialNotice } from "@/features/trial/trial-notice";
export const dynamic = "force-dynamic";
export default function Page() {
  return <><TrialNotice /><Revisit /></>;
}
