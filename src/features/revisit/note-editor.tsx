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
  const dirty = text !== photo.note_text;
  useEffect(() => {
    function leave(e: BeforeUnloadEvent) { if (dirty) { e.preventDefault(); e.returnValue = ""; } }
    function click(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target.closest("a,button[data-leave]") : null;
      if (dirty && target && !window.confirm("아직 저장하지 않은 메모가 있어요. 저장하지 않고 이동할까요?")) {
        e.preventDefault(); e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", leave); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", leave); document.removeEventListener("click", click, true); };
  }, [dirty]);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const saved = photoSchema.parse(await requestApi(`/api/photos/${photo.id}/note`, { method: "PUT", body: JSON.stringify({
        note_text: text, expected_version: version, request_id: crypto.randomUUID(),
      }) }));
      onSaved(saved); setText(saved.note_text); setVersion(saved.version); setConflict(null);
      setMessage("사진과 글을 보관함에 남겼어요.");
    } catch (error) {
      if (error instanceof RequestError && error.code === "VERSION_CONFLICT") {
        const details = error.details as { current: unknown };
        setConflict(photoSchema.parse(details.current));
      }
      setMessage(error instanceof Error ? error.message : "저장하지 못했어요. 다시 시도해주세요.");
    } finally { setBusy(false); }
  }
  return <section><label htmlFor="note">이 순간에서 무엇을 기억하고 싶나요?</label>
    <textarea id="note" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} aria-describedby="preservation note-length" />
    <p id="note-length">{[...text.trim()].length} / 500자</p>
    <p id="preservation">메모를 저장하면 이 사진과 글을 보관함에 남겨요. 메모를 비워도 사진은 보관함에 남아요.</p>
    {conflict && <aside className="notice"><p>현재 저장된 내용</p><p className="note">{conflict.note_text || "(빈 메모)"}</p>
      <button className="secondary" disabled={busy} onClick={() => { setVersion(conflict.version); setConflict(null); setMessage("작성 중인 내용을 유지했어요. 저장 버튼을 눌러 다시 저장해주세요."); }}>내 입력으로 다시 저장 준비</button>
    </aside>}
    <button onClick={() => void save()} disabled={busy || !!conflict || [...text.trim()].length > 500 || (!photo.preserved_at && !text.trim())}>
      {busy ? "저장 중…" : "메모와 함께 남기기"}</button><p role="status">{message}</p>
  </section>;
}
