import { SettingsForm } from "./settings-form";
import { TrialNotice } from "@/features/trial/trial-notice";
export default function Page() {
  return (
    <>
      <div style={{ padding: "16px 0 4px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.03em" }}>설정</h1>
      </div>
      <TrialNotice /><SettingsForm />
    </>
  );
}
