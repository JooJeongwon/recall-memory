"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestApi, RequestError } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";
import { demoImage, demoPhoto, isDemoMode } from "@/lib/demo";

export function NoteEditView({ id }: { id: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [version, setVersion] = useState(0);
  const [conflict, setConflict] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = text !== (photo?.note_text ?? "");
  const charCount = [...text.trim()].length;
  const overLimit = charCount > 500;

  useEffect(() => {
    let active = true;
    async function load() {
      if (isDemoMode() && id === demoPhoto.id) {
        setPhoto(demoPhoto);
        setText(demoPhoto.note_text ?? "");
        setVersion(demoPhoto.version);
        setUrl(demoImage);
        return;
      }
      try {
        const [data, asset] = await Promise.all([
          requestApi(`/api/photos/${id}`),
          requestApi<{ url: string }>(`/api/photos/${id}/asset?kind=thumbnail`),
        ]);
        if (active) {
          const p = photoSchema.parse(data);
          setPhoto(p);
          setText(p.note_text ?? "");
          setVersion(p.version);
          setUrl(asset.url);
        }
      } catch (e) {
        if (active) setMessage(e instanceof Error ? e.message : "다시 시도해주세요.");
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    function leave(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);

  async function save() {
    if (!photo) return;
    setBusy(true); setMessage(""); setSaved(false);
    try {
      if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, 500));
        setSaved(true);
        setMessage("데모 화면에서는 실제로 저장되지 않아요.");
        return;
      }
      const result = photoSchema.parse(await requestApi(`/api/photos/${photo.id}/note`, {
        method: "PUT",
        body: JSON.stringify({
          note_text: text,
          expected_version: version,
          request_id: crypto.randomUUID(),
        }),
      }));
      setPhoto(result);
      setText(result.note_text ?? "");
      setVersion(result.version);
      setConflict(null);
      setSaved(true);
      setMessage("저장했어요.");
      setTimeout(() => router.back(), 800);
    } catch (error) {
      if (error instanceof RequestError && error.code === "VERSION_CONFLICT") {
        const details = error.details as { current: unknown };
        setConflict(photoSchema.parse(details.current));
      }
      setMessage(error instanceof Error ? error.message : "저장하지 못했어요.");
    } finally { setBusy(false); }
  }

  return (
    <div className="note-editor-root">
      {/* Top bar */}
      <div className="note-editor-topbar">
        <button
          className="icon-btn"
          aria-label="뒤로"
          onClick={() => {
            if (dirty && !window.confirm("저장하지 않은 내용이 있어요. 이동할까요?")) return;
            router.back();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <span className="note-editor-title">메모 수정</span>
        <button
          className="button coral note-editor-save"
          onClick={() => void save()}
          disabled={busy || !!conflict || overLimit}
        >
          {busy ? "저장 중…" : "저장하기"}
        </button>
      </div>

      {/* Photo thumbnail */}
      {url && (
        <div className="note-editor-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="사진" />
        </div>
      )}

      {/* Editor */}
      <div className="note-editor-body">
        <p className="note-editor-question">이 순간을 기억하고 싶은 이유는?</p>

        {conflict && (
          <div className="notice" style={{ marginBottom: 12 }}>
            <strong>다른 기기에서 저장된 내용이 있어요</strong>
            <p style={{ marginTop: 6, marginBottom: 8 }}>{conflict.note_text || "(빈 메모)"}</p>
            <button
              className="ghost"
              style={{ fontSize: ".8rem", height: 34, minHeight: 34 }}
              disabled={busy}
              onClick={() => {
                setVersion(conflict.version);
                setConflict(null);
                setMessage("작성 중인 내용을 유지했어요.");
              }}
            >
              내 입력으로 덮어쓰기
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="note-editor-textarea"
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
          disabled={busy}
          placeholder="한 줄이어도 좋아요."
          aria-label="메모"
        />

        <p className={`note-editor-count${overLimit ? " warn" : ""}`}>
          {charCount} / 500
        </p>

        {message && (
          <p
            role="status"
            style={{
              marginTop: 12, fontSize: ".84rem",
              color: saved ? "var(--c-coral)" : "var(--c-danger)",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
