"use client";
import { useState } from "react";
import { requestApi } from "@/lib/api";
import { createArchive } from "./archive";

export function ExportButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      const data = await requestApi<{ original_filename: string; memory: unknown }>(`/api/photos/${id}/export`);
      const response = await fetch(`/api/photos/${id}/asset?kind=original`, { cache: "no-store", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error("사진을 가져오지 못했어요. 다시 시도해주세요.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const archive = createArchive(data.original_filename, bytes, data.memory);
      const url = URL.createObjectURL(new Blob([new Uint8Array(archive)], { type: "application/zip" }));
      const link = document.createElement("a"); link.href = url; link.download = `memory-${id}.zip`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("사진과 메모 ZIP을 만들었어요. 다운로드 파일을 확인해주세요.");
      void requestApi("/api/events", { method: "POST", body: JSON.stringify({ name: "export_generated", photo_id: id,
        client_event_id: crypto.randomUUID(), visit_context: "unknown" }) }).catch(() => {});
    } catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }
  return <div><button disabled={busy} onClick={() => void download()}>{busy ? "파일 준비 중…" : "사진과 메모 가져가기"}</button><p role="status">{message}</p></div>;
}
