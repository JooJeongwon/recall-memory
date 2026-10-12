"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { z } from "zod";
import { motion } from "motion/react";
import { requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";
import { demoImages, demoPhotos, isDemoMode } from "@/lib/demo";

import { NoteEditor } from "./note-editor";

const ease = [0.22, 1, 0.36, 1] as const;

export function Revisit() {
  const [photos, setPhotos] = useState<Photo[]>(isDemoMode() ? demoPhotos : []);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [message, setMessage] = useState(isDemoMode() ? "" : "사진을 불러오는 중…");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (isDemoMode()) return;
    let active = true;
    requestApi<{ photos: unknown[] }>("/api/photos?limit=20")
      .then((data) => {
        if (!active) return;
        const list = z.array(photoSchema).parse(data.photos);
        setPhotos(list);
        setIndex(Math.max(0, list.findIndex((p) => !p.first_viewed_at)));
        setMessage(list.length ? "" : "선택한 사진이 아직 없어요.");
      })
      .catch((e: Error) => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [retry]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback((len: number) => {
    setDirection(1);
    setIndex((i) => Math.min(len - 1, i + 1));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.matches("textarea,input")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") document.querySelector<HTMLButtonElement>(".revisit-side-btn.prev")?.click();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") document.querySelector<HTMLButtonElement>(".revisit-side-btn.next")?.click();
      if (e.key === "Escape") document.querySelector<HTMLButtonElement>(".revisit-nav-btn")?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, handlePrev, handleNext]);

  const current = photos[index];

  if (message && !photos.length) {
    return (
      <div className="revisit-screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <p role="status" style={{ color: "rgba(255,255,255,.5)", fontSize: ".9rem", marginBottom: 24 }}>
          {message}
        </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Link className="button coral" href="/start" style={{ fontSize: ".88rem", height: 44, minHeight: 44 }}>
              사진 선택하기
            </Link>
            <button className="ghost" style={{ fontSize: ".88rem", height: 44, minHeight: 44, color: "rgba(255,255,255,.6)", borderColor: "rgba(255,255,255,.2)" }}
              onClick={() => setRetry((v) => v + 1)}>
              새로고침
            </button>
          </div>
      </div>
    );
  }

  return (
    <div className="revisit-screen">
      {/* Top bar: back | counter | close */}
      <div className="revisit-topbar">
        <button
          className="revisit-nav-btn"
          data-leave aria-label="뒤로"
          onClick={() => window.history.back()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <span className="revisit-counter" aria-live="polite">
          {photos.length ? `${index + 1} / ${photos.length}` : "—"}
        </span>

        <button
          className="revisit-nav-btn"
          data-leave aria-label="닫기"
          onClick={() => window.history.back()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {current && (
        <ImmersivePhotoView
          key={current.id}
          photo={current}
          direction={direction}
          index={index}
          total={photos.length}
          onPhotoUpdated={(updated) =>
            setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }
          onPrev={handlePrev}
          onNext={() => handleNext(photos.length)}
          canPrev={index > 0}
          canNext={index < photos.length - 1}
        />
      )}
    </div>
  );
}

function ImmersivePhotoView({
  photo: initialPhoto,
  direction,
  onPhotoUpdated,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  photo: Photo;
  direction: number;
  index: number;
  total: number;
  onPhotoUpdated: (p: Photo) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const [photo, setPhoto] = useState(initialPhoto);
  const [url, setUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  /* Touch swipe */
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0 && canNext) document.querySelector<HTMLButtonElement>(".revisit-side-btn.next")?.click();
    if (dx > 0 && canPrev) document.querySelector<HTMLButtonElement>(".revisit-side-btn.prev")?.click();
  }, [canNext, canPrev]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (isDemoMode()) {
        setUrl(demoImages[initialPhoto.id] ?? demoImages[Object.keys(demoImages)[0]]);
        setLoadError("");
        return;
      }
      try {
        const data = await requestApi(`/api/photos/${initialPhoto.id}`);
        if (!active) return;
        const p = photoSchema.parse(data);
        setPhoto(p);
        setUrl(`/api/photos/${initialPhoto.id}/asset?kind=thumbnail`);
        setLoadError("");
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "다시 시도해주세요.");
      }
    }
    void load();
    return () => { active = false; };
  }, [initialPhoto.id]);

  const slideX = direction * 56;

  return (
    <>
      {/* Photo area — slides in from direction */}
      <motion.div
        className="revisit-photo-area"
        initial={{ opacity: 0, x: slideX, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.36, ease }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="선택한 기억 사진"
            onError={() => setLoadError("사진 접근 시간이 끝났어요.")}
            onLoad={() => {
              if (!isDemoMode()) {
                void requestApi(`/api/photos/${photo.id}/view`, { method: "POST" }).catch(() => {});
                void requestApi("/api/events", {
                  method: "POST",
                  body: JSON.stringify({
                    name: "photo_viewed",
                    photo_id: photo.id,
                    client_event_id: crypto.randomUUID(),
                    visit_context: "unknown",
                  }),
                }).catch(() => {});
              }
            }}
          />
        ) : loadError ? (
          <p style={{ color: "rgba(255,255,255,.55)", fontSize: ".86rem", padding: "0 24px", textAlign: "center" }}>
            {loadError}
          </p>
        ) : (
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: ".86rem" }} role="status">불러오는 중…</p>
        )}

        {/* Side navigation */}
        <button className="revisit-side-btn prev" disabled={!canPrev} data-leave aria-label="이전 사진" onClick={onPrev}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button className="revisit-side-btn next" disabled={!canNext} data-leave aria-label="다음 사진" onClick={onNext}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </motion.div>

      {/* Note panel */}
      <motion.div
        className="revisit-note-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.08, ease }}
      >
        {isDemoMode() ? <p>데모 화면에서는 실제로 저장되지 않아요.</p> : <NoteEditor photo={photo} onSaved={(updated) => { setPhoto(updated); onPhotoUpdated(updated); }} />}

      </motion.div>
    </>
  );
}
