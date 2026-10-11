"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";
import { ExportButton } from "../export/export-button";
import { DeletePhoto } from "../memories/delete-photo";
import { demoImage, demoPhoto, isDemoMode } from "@/lib/demo";

export function PhotoView({ id }: { id: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function load() {
      if (isDemoMode() && id === demoPhoto.id) {
        setPhoto(demoPhoto);
        setUrl(demoImage);
        setMessage("");
        return;
      }
      try {
        const [data, asset] = await Promise.all([
          requestApi(`/api/photos/${id}`),
          requestApi<{ url: string }>(`/api/photos/${id}/asset?kind=thumbnail`),
        ]);
        if (active) {
          setPhoto(photoSchema.parse(data));
          setUrl(asset.url);
          setMessage("");
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "다시 시도해주세요.");
      }
    }
    void load();
    return () => { active = false; };
  }, [id, retry]);

  if (message) {
    return (
      <div className="photo-detail-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <p className="error" role="alert" style={{ marginBottom: 16 }}>{message}</p>
        <button className="ghost" onClick={() => setRetry((v) => v + 1)}>다시 불러오기</button>
      </div>
    );
  }

  if (!photo || !url) {
    return (
      <div className="photo-detail-root">
        <div style={{ height: "62vh", background: "var(--c-bg2)" }} />
        <div style={{ flex: 1, padding: "20px" }}>
          <div style={{ width: "60%", height: 16, background: "var(--c-border)", borderRadius: 4, marginBottom: 12 }} />
          <div style={{ width: "80%", height: 24, background: "var(--c-border)", borderRadius: 4, marginBottom: 12 }} />
          <div style={{ width: "100%", height: 60, background: "var(--c-border)", borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  const dateLabel = photo.preserved_at
    ? new Date(photo.preserved_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : photo.ready_at
    ? new Date(photo.ready_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const titleText = photo.note_text
    ? photo.note_text.split(/[.。!！\n]/)[0].trim().slice(0, 20) || "기억"
    : "사진";

  return (
    <div className="photo-detail-root">
      {/* Photo area */}
      <div className="photo-detail-image-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="보관한 사진"
          onError={() => setMessage("사진 접근 시간이 끝났어요. 다시 불러와주세요.")}
          onLoad={() => {
            if (!isDemoMode()) {
              void requestApi("/api/events", {
                method: "POST",
                body: JSON.stringify({
                  name: "memory_opened",
                  photo_id: id,
                  client_event_id: crypto.randomUUID(),
                  visit_context: "unknown",
                }),
              }).catch(() => {});
            }
          }}
        />
        <div className="photo-detail-overlay" />
        <div className="photo-detail-topbar">
          <button className="photo-detail-back" aria-label="뒤로" onClick={() => router.back()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          {photo.preserved_at && (
            <span className="photo-detail-pos">보관됨</span>
          )}
        </div>
      </div>

      {/* Bottom detail panel */}
      <div className="photo-detail-panel">
        <div className="photo-detail-handle" />

        {dateLabel && (
          <p className="photo-detail-meta">{dateLabel}</p>
        )}

        <h1 className="photo-detail-title">{titleText}</h1>

        {photo.note_text ? (
          <p className="photo-detail-note">{photo.note_text}</p>
        ) : (
          <p className="photo-detail-note" style={{ color: "var(--c-muted)", fontStyle: "italic" }}>
            아직 메모가 없어요.
          </p>
        )}

        {/* Action buttons */}
        <div className="photo-detail-actions">
          <a
            className="photo-detail-action"
            href={`/photos/${id}/edit`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            수정하기
          </a>

          <div className="photo-detail-action" style={{ cursor: "default" }}>
            <ExportButton id={id} compact />
          </div>

          <div className="photo-detail-action danger" style={{ cursor: "pointer" }}>
            <DeletePhoto id={id} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
