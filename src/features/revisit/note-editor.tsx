"use client";
import { useEffect, useState } from "react";
import { RequestError, requestApi } from "@/lib/api";
import { policy } from "@/lib/config";
import { photoSchema, type Photo } from "@/lib/validation/contracts";

const hours = (value: number) => value * 60 * 60 * 1000;
const dateLabel = (value: string) => new Date(value).toLocaleString("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
});

export function NoteEditor({ photo, onSaved }: { photo: Photo; onSaved: (photo: Photo) => void }) {
  const [firstText, setFirstText] = useState(photo.note_text);
  const [secondText, setSecondText] = useState(photo.second_note_text);
  const [version, setVersion] = useState(photo.version);
  const [conflict, setConflict] = useState<Photo | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = firstText !== photo.note_text || secondText !== photo.second_note_text;
  const firstDeadline = new Date(Date.parse(photo.ready_at) + hours(policy.firstNoteHours)).toISOString();
  const secondDeadline = photo.first_note_at
    ? new Date(Date.parse(photo.first_note_at) + hours(policy.secondNoteHours)).toISOString() : null;

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

  async function save(stage: "first" | "second") {
    const text = stage === "first" ? firstText : secondText;
    setBusy(true); setMessage("");
    try {
      const saved = photoSchema.parse(await requestApi(`/api/photos/${photo.id}/note`, { method: "PUT", body: JSON.stringify({
        note_stage: stage, note_text: text, expected_version: version, request_id: crypto.randomUUID(),
      }) }));
      onSaved(saved);
      if (stage === "first") setFirstText(saved.note_text);
      else setSecondText(saved.second_note_text);
      setVersion(saved.version); setConflict(null);
      setMessage(stage === "first" ? "첫 번째 메모를 저장했어요." : "두 메모와 사진을 보관함에 남겼어요.");
    } catch (error) {
      if (error instanceof RequestError && error.code === "VERSION_CONFLICT") {
        const details = error.details as { current: unknown };
        setConflict(photoSchema.parse(details.current));
      }
      setMessage(error instanceof Error ? error.message : "저장하지 못했어요. 다시 시도해주세요.");
    } finally { setBusy(false); }
  }

  return <section>
    <p id="preservation">{photo.preserved_at ? "사진과 두 메모가 보관함에 있어요. 메모를 수정하거나 비워도 보관은 유지돼요." : photo.first_note_at
      ? "첫 번째 메모를 저장했어요. 아래 기한까지 두 번째 메모를 남기면 사진과 두 메모가 보관함에 유지돼요. 기한을 넘기면 함께 삭제돼요."
      : <>사진 업로드 완료 후 <time dateTime={firstDeadline}>{dateLabel(firstDeadline)}</time>까지 첫 메모를 남겨주세요. 첫 메모를 저장한 뒤 48시간 안에 두 번째 메모까지 남기면 사진과 두 메모가 보관함에 유지돼요. 기한을 넘기면 함께 삭제돼요.</>}</p>
    <p>첫 번째 메모</p>
    <label htmlFor="first-note">이 순간에서 무엇을 기억하고 싶나요?</label>
    <textarea id="first-note" value={firstText} onChange={(e) => setFirstText(e.target.value)} disabled={busy}
      aria-describedby="first-note-length preservation" />
    <p id="first-note-length">{[...firstText.trim()].length} / 500자</p>
    <button onClick={() => void save("first")} disabled={busy || !!conflict || [...firstText.trim()].length > 500 || (!firstText.trim() && !photo.preserved_at)}>
      {busy ? "저장 중…" : "첫 번째 메모 저장"}</button>

    {photo.first_note_at && secondDeadline && <>
      {photo.second_note_at ? <p>두 번째 메모를 <time dateTime={photo.second_note_at}>{dateLabel(photo.second_note_at)}</time>에 남겼어요. 사진과 두 메모가 보관함에 있어요.</p> : <p>두 번째 메모 기한: <time dateTime={secondDeadline}>{dateLabel(secondDeadline)}</time></p>}
      <label htmlFor="second-note">두 번째 메모</label>
      <textarea id="second-note" value={secondText} onChange={(e) => setSecondText(e.target.value)} disabled={busy}
        aria-describedby="second-note-length preservation" />
      <p id="second-note-length">{[...secondText.trim()].length} / 500자</p>
      <button onClick={() => void save("second")} disabled={busy || !!conflict || [...secondText.trim()].length > 500 || (!secondText.trim() && !photo.preserved_at)}>
        {busy ? "저장 중…" : "두 번째 메모 저장"}</button>
    </>}

    {conflict && <aside className="notice"><p>현재 저장된 첫 번째 메모</p><p className="note">{conflict.note_text || "(빈 메모)"}</p>
      <p>현재 저장된 두 번째 메모</p><p className="note">{conflict.second_note_text || "(빈 메모)"}</p>
      <button className="secondary" disabled={busy} onClick={() => { setVersion(conflict.version); setConflict(null); setMessage("작성 중인 내용을 유지했어요. 저장 버튼을 눌러 다시 저장해주세요."); }}>내 입력으로 다시 저장 준비</button>
    </aside>}
    <p role="status">{message}</p>
  </section>;
}
