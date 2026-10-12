"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestApi } from "@/lib/api";
import { type Photo } from "@/lib/validation/contracts";
import { demoImages, isDemoMode } from "@/lib/demo";

import { NoteEditor } from "../revisit/note-editor";
import { ExportButton } from "../export/export-button";

export function ViewerOverlay({
  photos,
  initialIndex,
  onClose,
  onDelete,
  onSaved,
}: {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSaved?: (photo: Photo) => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState("");
  const filmRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const current = photos[index];

  /* Scroll filmstrip to active thumb */
  useEffect(() => {
    const film = filmRef.current;
    if (!film) return;
    const thumb = film.children[index] as HTMLElement | undefined;
    if (!thumb) return;
    thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  /* Keyboard nav */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.matches("textarea,input")) return;
      if (e.key === "ArrowLeft") document.querySelector<HTMLButtonElement>(".viewer-nav-btn.prev")?.click();
      if (e.key === "ArrowRight") document.querySelector<HTMLButtonElement>(".viewer-nav-btn.next")?.click();
      if (e.key === "Escape") document.querySelector<HTMLButtonElement>(".viewer-back")?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0 && index < photos.length - 1) document.querySelector<HTMLButtonElement>(".viewer-nav-btn.next")?.click();
    if (dx > 0 && index > 0) document.querySelector<HTMLButtonElement>(".viewer-nav-btn.prev")?.click();
  }, [index, photos.length]);

  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!current) return;
    if (!window.confirm("사진과 메모가 화면에서 삭제됩니다. 데이터는 복구를 위해 서비스에 보관됩니다. 계속할까요?")) return;
    if (isDemoMode()) return;
    setDeleting(true);
    try {
      await requestApi(`/api/photos/${current.id}`, { method: "DELETE" });
      onDelete?.(current.id);
    } catch (error) { setDeleting(false); setMessage(error instanceof Error ? error.message : "삭제하지 못했어요."); }
  }

  return (
    <div className="viewer-screen" aria-modal="true" role="dialog" aria-label="사진 전체 보기">
      {/* Top bar */}
      <div className="viewer-topbar">
        <button className="viewer-back" data-leave aria-label="닫기" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <span className="viewer-counter">{index + 1} / {photos.length}</span>
        <div style={{ width: 36 }} />
      </div>

      {/* Photo area */}
      <div className="viewer-photo-area" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={isDemoMode() ? demoImages[current.id] : `/api/photos/${current.id}/asset?kind=thumbnail&retry=${retry}`} alt={current.note_text || "사진"} onError={() => setMessage("사진을 불러오지 못했어요. 다시 시도해주세요.")} />
        )}
        {message && <div><p role="alert">{message}</p><button onClick={() => { setMessage(""); setRetry((v) => v + 1); }}>다시 불러오기</button></div>}

        <button className="viewer-nav-btn prev" disabled={index === 0} data-leave aria-label="이전" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button className="viewer-nav-btn next" disabled={index === photos.length - 1} data-leave aria-label="다음" onClick={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {current && <div className="viewer-note-panel">
        {isDemoMode() ? <p>데모 화면에서는 실제로 저장되지 않아요.</p> : <NoteEditor key={current.id} photo={current} onSaved={(updated) => onSaved?.(updated)} />}
        <div className="actions">
          <ExportButton id={current.id} />
          <button data-leave className="danger" disabled={deleting || isDemoMode()} onClick={() => void handleDelete()}>{deleting ? "삭제 중…" : "삭제"}</button>
        </div>
      </div>}

      {/* Filmstrip */}
      <div className="viewer-filmstrip" ref={filmRef}>
        {photos.map((p, i) => (
          <button data-leave
            key={p.id}
            className={`viewer-film-thumb${i === index ? " active" : ""}`}
            onClick={() => setIndex(i)}
            aria-label={`사진 ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={isDemoMode() ? demoImages[p.id] : `/api/photos/${p.id}/asset?kind=thumbnail`} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
