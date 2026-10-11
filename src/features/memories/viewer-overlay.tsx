"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestApi } from "@/lib/api";
import { type Photo } from "@/lib/validation/contracts";
import { demoImage, isDemoMode } from "@/lib/demo";

export function ViewerOverlay({
  photos,
  initialIndex,
  onClose,
}: {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const filmRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const current = photos[index];

  /* Preload current + neighbors */
  useEffect(() => {
    const toLoad = [index - 1, index, index + 1].filter((i) => i >= 0 && i < photos.length);
    toLoad.forEach((i) => {
      const p = photos[i];
      if (!p || urls[p.id]) return;
      if (isDemoMode()) {
        setUrls((u) => ({ ...u, [p.id]: demoImage }));
        return;
      }
      requestApi<{ url: string }>(`/api/photos/${p.id}/asset?kind=thumbnail`)
        .then((data) => setUrls((u) => ({ ...u, [p.id]: data.url })))
        .catch(() => {});
    });
  }, [index, photos, urls]);

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
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(photos.length - 1, i + 1));
      if (e.key === "Escape") onClose();
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
    if (dx < 0 && index < photos.length - 1) setIndex((i) => i + 1);
    if (dx > 0 && index > 0) setIndex((i) => i - 1);
  }, [index, photos.length]);

  return (
    <div className="viewer-screen" aria-modal="true" role="dialog" aria-label="사진 전체 보기">
      {/* Top bar */}
      <div className="viewer-topbar">
        <button className="viewer-back" aria-label="닫기" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <span className="viewer-counter">{index + 1} / {photos.length}</span>
        <div style={{ width: 36 }} />
      </div>

      {/* Photo area */}
      <div
        className="viewer-photo-area"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {current && urls[current.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[current.id]} alt={current.note_text ?? "사진"} />
        ) : (
          <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".86rem" }} role="status">불러오는 중…</p>
        )}

        <button
          className="viewer-nav-btn prev"
          disabled={index === 0}
          aria-label="이전"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button
          className="viewer-nav-btn next"
          disabled={index === photos.length - 1}
          aria-label="다음"
          onClick={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Filmstrip */}
      <div className="viewer-filmstrip" ref={filmRef}>
        {photos.map((p, i) => (
          <div
            key={p.id}
            className={`viewer-film-thumb${i === index ? " active" : ""}`}
            onClick={() => setIndex(i)}
            role="button"
            tabIndex={0}
            aria-label={`사진 ${i + 1}`}
            onKeyDown={(e) => e.key === "Enter" && setIndex(i)}
          >
            {urls[p.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[p.id]} alt="" loading="lazy" />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,.08)" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
