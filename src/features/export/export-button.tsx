"use client";
import { useState } from "react";
import { requestApi } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

export function ExportButton({ id, compact }: { id: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function download() {
    if (isDemoMode()) { setMessage("데모 모드에서는 다운로드할 수 없어요."); return; }
    setBusy(true); setMessage("");
    // 서버가 Content-Disposition: attachment 로 응답하므로 모든 브라우저(iOS Safari 포함)에서 다운로드됩니다.
    const a = document.createElement("a");
    a.href = `/api/photos/${id}/export/zip`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => setBusy(false), 1500);
    void requestApi("/api/events", {
      method: "POST",
      body: JSON.stringify({
        name: "export_generated", photo_id: id,
        client_event_id: crypto.randomUUID(), visit_context: "unknown",
      }),
    }).catch(() => {});
  }

  if (compact) {
    return (
      <>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" onClick={download} style={{ cursor: busy ? "not-allowed" : "pointer" }}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span style={{ fontSize: ".72rem", color: "var(--c-sub)", fontWeight: 600 }}>
          {busy ? "준비 중…" : "다운로드"}
        </span>
        {message && <p style={{ fontSize: ".7rem", color: "var(--c-muted)", marginTop: 2 }}>{message}</p>}
      </>
    );
  }

  return (
    <div>
      <button className="ghost" disabled={busy} onClick={download}>
        {busy ? "파일 준비 중…" : "사진과 메모 가져가기"}
      </button>
      {message && (
        <p role="status" className={message.includes("못") ? "error" : ""}
          style={{ marginTop: 8, fontSize: ".82rem" }}>
          {message}
        </p>
      )}
    </div>
  );
}
