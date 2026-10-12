"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";
import { demoImages, demoPhotos, isDemoMode } from "@/lib/demo";
import { NoteEditor } from "./note-editor";

export function NoteEditView({ id }: { id: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = isDemoMode() ? demoPhotos.find((p) => p.id === id) : await requestApi(`/api/photos/${id}`);
        if (active) { setPhoto(photoSchema.parse(data)); setMessage(""); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "다시 시도해주세요."); }
    }
    void load();
    return () => { active = false; };
  }, [id, retry]);
  return <div className="note-editor-root">
    <div className="note-editor-topbar"><Link href={`/photos/${id}`}>뒤로</Link><h1>메모 수정</h1></div>
    {message && <><p role="alert">{message}</p><button onClick={() => setRetry((v) => v + 1)}>다시 불러오기</button></>}
    {photo && <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="photo" src={isDemoMode() ? demoImages[id] : `/api/photos/${id}/asset?kind=thumbnail&retry=${retry}`} alt="선택한 사진" onError={() => setMessage("사진을 불러오지 못했어요.")} />
      {isDemoMode() ? <p>데모 화면에서는 실제로 저장되지 않아요.</p> : <NoteEditor key={id} photo={photo} onSaved={setPhoto} />}
    </>}
  </div>;
}
