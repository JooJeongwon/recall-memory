"use client";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";
import { NoteEditor } from "./note-editor";
import { ExportButton } from "../export/export-button";
import { DeletePhoto } from "../memories/delete-photo";

export function PhotoView({ id, detail = false }: { id: string; detail?: boolean }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [data, asset] = await Promise.all([requestApi(`/api/photos/${id}`),
          requestApi<{ url: string }>(`/api/photos/${id}/asset?kind=thumbnail`)]);
        if (active) { setPhoto(photoSchema.parse(data)); setUrl(asset.url); setMessage(""); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "다시 시도해주세요."); }
    }
    void load(); return () => { active = false; };
  }, [id, retry]);
  return <>{message && <><p className="error" role="alert">{message}</p><button onClick={() => setRetry((v) => v + 1)}>다시 불러오기</button></>}
    {photo && url ? <>
      {/* 비공개 URL을 Next 이미지 최적화 캐시에 넣지 않습니다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="photo" src={url} alt="선택한 기억 사진" onError={() => setMessage("사진 접근 시간이 끝났어요. 다시 불러와주세요.")}
        onLoad={() => {
          if (!detail) void requestApi(`/api/photos/${id}/view`, { method: "POST" }).catch(() => {});
          void requestApi("/api/events", { method: "POST", body: JSON.stringify({
            name: detail && photo.preserved_at ? "memory_opened" : "photo_viewed", photo_id: id,
            client_event_id: crypto.randomUUID(), visit_context: "unknown",
          }) }).catch(() => {});
        }} />
      <NoteEditor key={id} photo={photo} onSaved={setPhoto} />
      {detail && <div className="actions"><ExportButton id={id} /><DeletePhoto id={id} /></div>}
    </> : !message && <p role="status">사진을 불러오는 중…</p>}</>;
}
