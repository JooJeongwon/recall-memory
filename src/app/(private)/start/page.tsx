import Link from "next/link";
import { UploadForm } from "@/features/upload/upload-form";
import { TrialNotice } from "@/features/trial/trial-notice";

export default function Page() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 12px" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-.03em" }}>
          사진 선택
        </h1>
        <Link href="/revisit" style={{ fontSize: ".82rem", color: "var(--c-muted)", textDecoration: "none" }}>
          건너뛰기
        </Link>
      </div>
      <TrialNotice />
      <UploadForm />
    </>
  );
}
