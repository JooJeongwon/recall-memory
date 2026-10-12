"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { z } from "zod";
import { motion } from "motion/react";
import { requestApi, RequestError } from "@/lib/api";
import { photoSchema, noteStage, editableNote, noteHint, type Photo } from "@/lib/validation/contracts";
import { demoImages, demoPhotos, isDemoMode } from "@/lib/demo";

const ease = [0.22, 1, 0.36, 1] as const;

export function Revisit() {
  const [photos, setPhotos] = useState<Photo[]>(isDemoMode() ? demoPhotos : []);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [message, setMessage] = useState(isDemoMode() ? "" : "사진을 불러오는 중…");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (isDemoMode()) return;
    requestApi<{ photos: unknown[] }>("/api/photos?limit=20")
      .then((data) => {
        const list = z.array(photoSchema).parse(data.photos);
        setPhotos(list);
        setIndex(Math.max(0, list.findIndex((p) => !p.first_viewed_at)));
        setMessage(list.length ? "" : "선택한 사진이 아직 없어요.");
      })
      .catch((e: Error) => setMessage(e.message));
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
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") handlePrev();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") handleNext(photos.length);
      if (e.key === "Escape") window.history.back();
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
        {message !== "사진을 불러오는 중…" && (
          <div style={{ display: "flex", gap: 10 }}>
            <Link className="button coral" href="/start" style={{ fontSize: ".88rem", height: 44, minHeight: 44 }}>
              사진 선택하기
            </Link>
            <button className="ghost" style={{ fontSize: ".88rem", height: 44, minHeight: 44, color: "rgba(255,255,255,.6)", borderColor: "rgba(255,255,255,.2)" }}
              onClick={() => setRetry((v) => v + 1)}>
              새로고침
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="revisit-screen">
      {/* Top bar: back | counter | close */}
      <div className="revisit-topbar">
        <button
          className="revisit-nav-btn"
          aria-label="뒤로"
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
          aria-label="닫기"
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
  const [loaded, setLoaded] = useState(isDemoMode());
  const [text, setText] = useState(editableNote(initialPhoto));
  const [version, setVersion] = useState(initialPhoto.version);
  const [conflict, setConflict] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const dirty = text !== editableNote(photo);
  const charCount = [...text.trim()].length;
  const overLimit = charCount > 500;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (dx < 0 && canNext) onNext();
    if (dx > 0 && canPrev) onPrev();
  }, [canNext, canPrev, onNext, onPrev]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (isDemoMode()) {
        setUrl(demoImages[initialPhoto.id] ?? demoImages[Object.keys(demoImages)[0]]);
        setLoadError("");
        return;
      }
      try {
        const [data, asset] = await Promise.all([
          requestApi(`/api/photos/${initialPhoto.id}`),
          requestApi<{ url: string }>(`/api/photos/${initialPhoto.id}/asset?kind=thumbnail`),
        ]);
        if (!active) return;
        const p = photoSchema.parse(data);
        setPhoto(p);
        setText(editableNote(p));
        setVersion(p.version);
        setUrl(asset.url);
        setLoadError("");
        setLoaded(true);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "다시 시도해주세요.");
      }
    }
    void load();
    return () => { active = false; };
  }, [initialPhoto.id]);

  useEffect(() => {
    function leave(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);

  async function save() {
    setBusy(true); setSaveMsg(""); setSaved(false);
    try {
      if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, 500));
        const now = new Date().toISOString();
        const result = noteStage(photo) === "first"
          ? { ...photo, note_text: text.trim(), first_note_at: now, version: version + 1 }
          : { ...photo, second_note_text: text.trim(), second_note_at: photo.second_note_at ?? now, preserved_at: photo.preserved_at ?? now, version: version + 1 };
        setPhoto(result);
        setText(editableNote(result));
        setVersion(result.version);
        setSaved(true);
        setSaveMsg("데모 화면에서는 실제로 저장되지 않아요.");
        onPhotoUpdated(result);
        return;
      }
      const result = photoSchema.parse(await requestApi(`/api/photos/${photo.id}/note`, {
        method: "PUT",
        body: JSON.stringify({
          note_text: text,
          expected_version: version,
          request_id: crypto.randomUUID(),
          note_stage: noteStage(photo),
        }),
      }));
      setPhoto(result);
      setText(editableNote(result));
      setVersion(result.version);
      setConflict(null);
      setSaved(true);
      setSaveMsg(result.preserved_at ? "사진과 두 메모를 보관함에 남겼어요." : "첫 메모를 저장했어요. 두 번째 메모를 남겨주세요.");
      onPhotoUpdated(result);
    } catch (error) {
      if (error instanceof RequestError && error.code === "VERSION_CONFLICT") {
        const details = error.details as { current: unknown };
        setConflict(photoSchema.parse(details.current));
      }
      setSaveMsg(error instanceof Error ? error.message : "저장하지 못했어요. 다시 시도해주세요.");
    } finally { setBusy(false); }
  }

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
        <button className="revisit-side-btn prev" disabled={!canPrev} aria-label="이전 사진" onClick={onPrev}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button className="revisit-side-btn next" disabled={!canNext} aria-label="다음 사진" onClick={onNext}>
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
        <p className="revisit-note-question">이 순간을 기억하고 싶은 이유는?</p>
        <p role="status" style={{ color: "rgba(255,255,255,.65)", fontSize: ".8rem", marginBottom: 8 }}>{noteHint(photo)}</p>
        {photo.first_note_at && <p style={{ color: "rgba(255,255,255,.8)", fontSize: ".82rem", whiteSpace: "pre-wrap", maxHeight: 100, overflow: "auto" }}>첫 번째 메모: {photo.note_text || "(빈 메모)"}</p>}

        {conflict && (
          <div className="revisit-conflict">
            <strong>다른 기기에서 저장된 내용이 있어요</strong>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: ".84rem", margin: "4px 0 8px" }}>
              {editableNote(conflict) || "(빈 메모)"}
            </p>
            <button
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,.2)",
                color: "rgba(255,255,255,.65)", fontSize: ".78rem",
                padding: "5px 12px", height: 30, minHeight: 30, borderRadius: "var(--r-pill)"
              }}
              disabled={busy}
              onClick={() => {
                setVersion(conflict.version);
                setPhoto(conflict);
                setConflict(null);
                setSaveMsg("작성 중인 내용을 유지했어요. 저장해주세요.");
              }}
            >
              내 입력으로 덮어쓰기
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="revisit-note-textarea"
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); setSaveMsg(""); }}
          disabled={busy || !loaded}
          placeholder="한 줄이어도 좋아요."
          aria-label="기억 메모"
          rows={3}
        />

        <div className="revisit-note-meta">
          <span className={`revisit-note-count${overLimit ? " warn" : ""}`}>
            {charCount} / 500
          </span>
        </div>

        <motion.button
          className="revisit-save-btn"
          onClick={() => void save()}
          disabled={busy || !loaded || !!conflict || overLimit || (!photo.preserved_at && !text.trim())}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
        >
          {busy ? "저장 중…" : photo.preserved_at ? "메모 수정하기" : photo.first_note_at ? "두 번째 메모 남기기" : "첫 번째 메모 남기기"}
        </motion.button>

        {saveMsg && (
          <p className={`revisit-save-msg${!saved && saveMsg.includes("못") ? " error" : ""}`}>
            {saveMsg}
          </p>
        )}

      </motion.div>
    </>
  );
}
