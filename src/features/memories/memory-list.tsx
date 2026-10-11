"use client";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";
import { demoImage, demoPhoto, isDemoMode } from "@/lib/demo";
import { ViewerOverlay } from "./viewer-overlay";

export function MemoryList() {
  const [photos, setPhotos] = useState<Photo[]>(isDemoMode() ? [demoPhoto] : []);
  const [message, setMessage] = useState(isDemoMode() ? "" : "보관함을 불러오는 중…");
  const [retry, setRetry] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isDemoMode()) return;
    requestApi<{ photos: unknown[] }>("/api/photos?scope=preserved&limit=20")
      .then((data) => {
        const list = z.array(photoSchema).parse(data.photos);
        setPhotos(list);
        setMessage(list.length ? "" : "empty");
      })
      .catch((e: Error) => setMessage(e.message));
  }, [retry]);

  const openViewer = useCallback((idx: number) => setViewerIndex(idx), []);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

  if (message === "empty") {
    return (
      <div style={{ textAlign: "center", padding: "72px 0 40px", animation: "fade-up 480ms cubic-bezier(0.22,1,0.36,1) both" }}>
        <div style={{
          width: 72, height: 72,
          borderRadius: "50%",
          background: "var(--c-bg2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          color: "var(--c-muted)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        </div>
        <p style={{ fontSize: ".98rem", fontWeight: 700, color: "var(--c-text)", marginBottom: 8, letterSpacing: "-.02em" }}>
          아직 전시된 기억이 없어요.
        </p>
        <p style={{ color: "var(--c-muted)", fontSize: ".86rem", marginBottom: 32, maxWidth: "22ch", marginInline: "auto", lineHeight: 1.7 }}>
          사진을 다시 보고, 기억하고 싶은 순간을 남겨보세요.
        </p>
        <a className="button coral" href="/revisit" style={{ display: "inline-flex" }}>
          사진 다시 보기
        </a>
      </div>
    );
  }

  return (
    <>
      {message && message !== "empty" && (
        <p role="status" style={{ color: "var(--c-muted)", fontSize: ".86rem", padding: "20px 0" }}>
          {message}
        </p>
      )}

      {photos.length > 0 && (
        <div className="gallery" aria-label="보관한 기억 목록">
          {photos.map((photo, i) => (
            <GalleryTile
              key={photo.id}
              photo={photo}
              onOpen={() => openViewer(i)}
            />
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ textAlign: "center", paddingTop: 16 }}>
          <button
            className="ghost"
            style={{ fontSize: ".8rem", height: 38, minHeight: 38, padding: "0 20px" }}
            onClick={() => { setPhotos([]); setMessage("보관함을 불러오는 중…"); setRetry((v) => v + 1); }}
          >
            새로고침
          </button>
        </div>
      )}

      {viewerIndex !== null && (
        <ViewerOverlay
          photos={photos}
          initialIndex={viewerIndex}
          onClose={closeViewer}
        />
      )}
    </>
  );
}

function GalleryTile({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const [url, setUrl] = useState(isDemoMode() ? demoImage : "");

  useEffect(() => {
    if (isDemoMode()) return;
    let active = true;
    requestApi<{ url: string }>(`/api/photos/${photo.id}/asset`)
      .then((data) => { if (active) setUrl(data.url); })
      .catch(() => {});
    return () => { active = false; };
  }, [photo.id]);

  return (
    <div
      className="gallery-tile"
      role="button"
      tabIndex={0}
      aria-label={photo.note_text ? photo.note_text.slice(0, 40) : "사진 열기"}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" />
      ) : (
        <div className="gallery-tile-skeleton" />
      )}
      {photo.note_text && (
        <div className="gallery-tile-overlay">
          <p className="gallery-tile-note">{photo.note_text}</p>
        </div>
      )}
    </div>
  );
}
