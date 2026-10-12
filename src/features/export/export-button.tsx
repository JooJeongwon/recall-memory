"use client";
import { useState } from "react";
import { requestApi } from "@/lib/api";
import { createArchive, fetchArchiveItem, saveArchive } from "./archive";

import { isDemoMode } from "@/lib/demo";

export function ExportButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    if (isDemoMode()) { setMessage("데모 모드에서는 다운로드할 수 없어요."); return; }
    setBusy(true); setMessage("");
    try {
      const data = await fetchArchiveItem(id);
      const archive = createArchive(data.originalName, data.bytes, data.memory);
      saveArchive(archive, `memory-${id}.zip`);
      setMessage("사진과 두 메모가 담긴 ZIP을 만들었어요. 다운로드 파일을 확인해주세요.");
      void requestApi("/api/events", { method: "POST", body: JSON.stringify({ name: "export_generated", photo_id: id,
        client_event_id: crypto.randomUUID(), visit_context: "unknown" }) }).catch(() => {});
    } catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }
  return <div><button className={compact ? "photo-detail-action" : "ghost"} disabled={busy} onClick={() => void download()}>{busy ? "파일 준비 중…" : "사진과 메모 가져가기"}</button><p role="status">{message}</p></div>;
}
