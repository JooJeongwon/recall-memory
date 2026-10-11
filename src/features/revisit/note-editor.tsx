"use client";
import { useEffect, useState } from "react";
import { RequestError, requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";

export function NoteEditor({ photo, onSaved }: { photo: Photo; onSaved: (photo: Photo) => void }) {
  const [text, setText] = useState(photo.note_text);
  const [version, setVersion] = useState(photo.version);
  const [conflict, setConflict] = useState<Photo | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = text !== photo.note_text;
  const charCount = [...text.trim()].length;
  const overLimit = charCount > 500;

  useEffect(() => {
    function leave(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    function click(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target.closest("a,button[data-leave]") : null;
      if (dirty && target && !window.confirm("아직 저장하지 않은 메모가 있어요. 저장하지 않고 이동할까요?")) {
        e.preventDefault(); e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);

  async function save() {
    setBusy(true); setMessage(""); setSaved(false);
    try {
      const result = photoSchema.parse(await requestApi(`/api/photos/${photo.id}/note`, {
        method: "PUT",
        body: JSON.stringify({
          note_text: text,
          expected_version: version,
          request_id: crypto.randomUUID(),
        }),
      }));
      onSaved(result);
      setText(result.note_text);
      setVersion(result.version);
      setConflict(null);
      setSaved(true);
      setMessage("기억으로 남겼어요.");
    } catch (error) {
      if (error instanceof RequestError && error.code === "VERSION_CONFLICT") {
        const details = error.details as { current: unknown };
        setConflict(photoSchema.parse(details.current));
      }
      setMessage(error instanceof Error ? error.message : "저장하지 못했어요. 다시 시도해주세요.");
    } finally { setBusy(false); }
  }

  return (
    <div className="note-section">
      <label htmlFor="note">이 순간을 기억하고 싶은 이유는?</label>
      <textarea
        id="note"
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        disabled={busy}
        placeholder="한 줄이어도 좋아요."
        aria-describedby="preservation note-length"
      />
      <div className="note-meta">
        <p id="preservation" className="note-hint">
          메모를 저장하면 이 사진이 보관함에 남아요.
        </p>
        <span id="note-length" className={`note-count${overLimit ? " warn" : ""}`}>
          {charCount} / 500
        </span>
      </div>

      {conflict && (
        <aside className="notice" style={{ marginBottom: 16 }}>
          <strong>다른 기기에서 저장된 내용이 있어요</strong>
          <p className="note" style={{ margin: "8px 0", color: "var(--c-text)", fontSize: ".88rem" }}>
            {conflict.note_text || "(빈 메모)"}
          </p>
          <button
            className="ghost"
            style={{ fontSize: ".82rem" }}
            disabled={busy}
            onClick={() => {
              setVersion(conflict.version);
              setConflict(null);
              setMessage("작성 중인 내용을 유지했어요. 저장 버튼을 눌러주세요.");
            }}
          >
            내 입력으로 덮어쓰기
          </button>
        </aside>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          className="coral"
          onClick={() => void save()}
          disabled={busy || !!conflict || overLimit || (!photo.preserved_at && !text.trim())}
        >
          {busy ? "저장 중…" : "기억으로 남기기"}
        </button>
        {saved && (
          <span className="preserved-badge" aria-live="polite">
            ✓ 보관함에 남겼어요
          </span>
        )}
      </div>

      {message && !saved && (
        <p
          className={message.includes("못했") || message.includes("않") ? "error" : ""}
          role="status"
          style={{ marginTop: 12, fontSize: ".86rem" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
