"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestApi } from "@/lib/api";
import { type Photo } from "@/lib/validation/contracts";
import { demoImage, isDemoMode } from "@/lib/demo";

export function ViewerOverlay({
  photos,
  initialIndex,
  onClose,
  onDelete,
}: {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (id: string) => void;
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
      if (isDemoMode()) { setUrls((u) => ({ ...u, [p.id]: demoImage })); return; }
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

  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!current) return;
    if (!window.confirm("사진과 메모가 함께 삭제됩니다. 필요하면 먼저 가져가세요. 삭제할까요?")) return;
    if (isDemoMode()) return;
    setDeleting(true);
    try {
      await requestApi(`/api/photos/${current.id}`, { method: "DELETE" });
      onDelete?.(current.id);
    } catch { setDeleting(false); }
  }

  const dateLabel = current?.preserved_at
    ? new Date(current.preserved_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null;

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
      <div className="viewer-photo-area" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {current && urls[current.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[current.id]} alt={current.note_text ?? "사진"} />
        ) : (
          <p style={{ color: "rgba(255,255,255,.3)", fontSize: ".86rem" }} role="status">불러오는 중…</p>
        )}
        <button className="viewer-nav-btn prev" disabled={index === 0} aria-label="이전" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button className="viewer-nav-btn next" disabled={index === photos.length - 1} aria-label="다음" onClick={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Detail panel */}
      {current && (
        <div style={{
          padding: "14px 20px 8px",
          color: "#fff",
          borderTop: "1px solid rgba(255,255,255,.08)",
        }}>
          {dateLabel && (
            <p style={{ fontSize: ".74rem", color: "rgba(255,255,255,.42)", marginBottom: 6, letterSpacing: ".02em" }}>
              {dateLabel}
            </p>
          )}
          <p style={{
            fontSize: ".9rem", lineHeight: 1.55, marginBottom: 12,
            color: current.note_text ? "rgba(255,255,255,.88)" : "rgba(255,255,255,.3)",
            fontStyle: current.note_text ? "normal" : "italic",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {current.note_text || "메모가 없어요."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={`/photos/${current.id}/edit`}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                height: 38, borderRadius: 10,
                background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)",
                fontSize: ".8rem", fontWeight: 600, textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              수정
            </a>
            {!isDemoMode() && (
              <a
                href={`/api/photos/${current.id}/export/zip`}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  height: 38, borderRadius: 10,
                  background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)",
                  fontSize: ".8rem", fontWeight: 600, textDecoration: "none",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                가져가기
              </a>
            )}
            {!isDemoMode() && (
              <button
                disabled={deleting}
                onClick={() => void handleDelete()}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  height: 38, borderRadius: 10, border: "none", cursor: deleting ? "not-allowed" : "pointer",
                  background: "rgba(220,53,69,.15)", color: "rgba(220,53,69,.9)",
                  fontSize: ".8rem", fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
                {deleting ? "삭제 중…" : "삭제"}
              </button>
            )}
          </div>
        </div>
      )}

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
