"use client";
import { useState } from "react";
import { requestApi } from "@/lib/api";
import { createArchive } from "./archive";
import { isDemoMode } from "@/lib/demo";

export function ExportButton({ id, compact }: { id: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download() {
    if (isDemoMode()) {
      setMessage("데모 모드에서는 다운로드할 수 없어요.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const data = await requestApi<{ url: string; original_filename: string; memory: unknown }>(
        `/api/photos/${id}/export`
      );
      const response = await fetch(data.url, { cache: "no-store", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error("사진을 가져오지 못했어요. 다시 시도해주세요.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const archive = createArchive(data.original_filename, bytes, data.memory);
      const url = URL.createObjectURL(new Blob([new Uint8Array(archive)], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url; link.download = `memory-${id}.zip`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("ZIP 파일 준비됐어요.");
      void requestApi("/api/events", {
        method: "POST",
        body: JSON.stringify({
          name: "export_generated", photo_id: id,
          client_event_id: crypto.randomUUID(), visit_context: "unknown",
        }),
      }).catch(() => {});
    } catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  if (compact) {
    return (
      <>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" onClick={() => void download()} style={{ cursor: "pointer" }}>
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
      <button className="ghost" disabled={busy} onClick={() => void download()}>
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
