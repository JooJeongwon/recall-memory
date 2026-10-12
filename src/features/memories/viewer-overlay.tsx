"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequestError, requestApi } from "@/lib/api";
import { photoSchema, noteStage, editableNote, memoryNote, type Photo } from "@/lib/validation/contracts";
import { ExportButton } from "../export/export-button";
import { demoImage, isDemoMode } from "@/lib/demo";

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
  const [urls, setUrls] = useState<Record<string, string>>({});
  const filmRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const current = photos[index];

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(current ? editableNote(current) : "");
  const [editVersion, setEditVersion] = useState(current?.version ?? 1);
  const [localPhoto, setLocalPhoto] = useState<Photo | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const goTo = useCallback((nextIndex: number) => {
    const next = photos[nextIndex];
    if (!next || nextIndex === index) return;
    setIndex(nextIndex);
    setLocalPhoto(null);
    setEditing(false);
    setEditText(editableNote(next));
    setEditVersion(next.version);
    setSaveMsg("");
  }, [photos, index]);

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
      if (e.key === "ArrowLeft") goTo(index - 1);
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goTo(index + 1);
    if (dx > 0) goTo(index - 1);
  }, [index, goTo]);

  const effectivePhoto = localPhoto ?? current;
  const dateLabel = effectivePhoto?.preserved_at
    ? new Date(effectivePhoto.preserved_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null;

  async function handleSave() {
    if (!effectivePhoto || isDemoMode()) return;
    setSaveBusy(true);
    setSaveMsg("");
    try {
      const result = photoSchema.parse(await requestApi(`/api/photos/${effectivePhoto.id}/note`, {
        method: "PUT",
        body: JSON.stringify({
          note_text: editText,
          expected_version: editVersion,
          request_id: crypto.randomUUID(),
          note_stage: noteStage(effectivePhoto),
        }),
      }));
      setLocalPhoto(result);
      setEditText(editableNote(result));
      setEditVersion(result.version);
      setEditing(false);
      setSaveMsg("기억으로 남겼어요.");
      onSaved?.(result);
    } catch (error) {
      if (error instanceof RequestError && error.code === "VERSION_CONFLICT") {
        setSaveMsg("다른 기기에서 저장된 내용이 있어요. 새로고침 후 다시 시도해주세요.");
      } else {
        setSaveMsg(error instanceof Error ? error.message : "저장하지 못했어요.");
      }
    } finally {
      setSaveBusy(false);
    }
  }

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
        <button className="viewer-nav-btn prev" disabled={index === 0} aria-label="이전" onClick={() => goTo(index - 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button className="viewer-nav-btn next" disabled={index === photos.length - 1} aria-label="다음" onClick={() => goTo(index + 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Detail panel */}
      {effectivePhoto && (
        <div style={{ padding: "14px 20px 8px", color: "#fff", borderTop: "1px solid rgba(255,255,255,.08)" }}>
          {dateLabel && (
            <p style={{ fontSize: ".74rem", color: "rgba(255,255,255,.42)", marginBottom: 6, letterSpacing: ".02em" }}>
              {dateLabel}
            </p>
          )}
          {effectivePhoto.first_note_at && <p style={{ color: "rgba(255,255,255,.7)", fontSize: ".8rem", maxHeight: 100, overflow: "auto", whiteSpace: "pre-wrap" }}>첫 번째 메모: {effectivePhoto.note_text || "(빈 메모)"}</p>}
          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              disabled={saveBusy}
              placeholder="한 줄이어도 좋아요."
              rows={3}
              style={{
                width: "100%", background: "rgba(255,255,255,.08)", color: "#fff",
                border: "1px solid rgba(255,255,255,.2)", borderRadius: 8,
                padding: "8px 10px", fontSize: ".88rem", lineHeight: 1.55,
                resize: "vertical", marginBottom: 8, boxSizing: "border-box",
              }}
            />
          ) : (
            <p style={{
              fontSize: ".9rem", lineHeight: 1.55, marginBottom: 12,
              color: memoryNote(effectivePhoto) ? "rgba(255,255,255,.88)" : "rgba(255,255,255,.3)",
              fontStyle: memoryNote(effectivePhoto) ? "normal" : "italic",
              display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {memoryNote(effectivePhoto) || "메모가 없어요."}
            </p>
          )}
          {saveMsg && (
            <p style={{
              fontSize: ".78rem", marginBottom: 8,
              color: saveMsg.includes("못") || saveMsg.includes("있어요") ? "rgba(220,100,100,.9)" : "rgba(100,220,130,.9)",
            }}>
              {saveMsg}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {!isDemoMode() && <ExportButton id={effectivePhoto.id} compact />}
            <button
              onClick={() => { setEditing(true); setEditText(editableNote(effectivePhoto)); setSaveMsg(""); }}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                height: 38, borderRadius: 10, border: "none", cursor: "pointer",
                background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)",
                fontSize: ".8rem", fontWeight: 600,
              }}
            >
              수정
            </button>
            {!isDemoMode() && (
              <button
                onClick={() => void handleSave()}
                disabled={saveBusy || !editing || [...editText.trim()].length > 500 || (!effectivePhoto.preserved_at && !editText.trim())}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  height: 38, borderRadius: 10, border: "none", cursor: saveBusy ? "not-allowed" : "pointer",
                  background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)",
                  fontSize: ".8rem", fontWeight: 600,
                }}
              >
                {saveBusy ? "저장 중…" : "저장"}
              </button>
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
            onClick={() => goTo(i)}
            role="button"
            tabIndex={0}
            aria-label={`사진 ${i + 1}`}
            onKeyDown={(e) => e.key === "Enter" && goTo(i)}
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
