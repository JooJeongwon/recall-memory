"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { requestApi } from "@/lib/api";
import { formats, policy } from "@/lib/config";

type Item = { file: File; requestId: string; status: string; done: boolean };
type Reservation = { id: string; path?: string; already_ready: boolean };
export function UploadForm() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function select(files: FileList | null) {
    if (!files) return;
    if (files.length > policy.maxBatch) { setMessage("한 번에 10장까지 선택해주세요."); return; }
    setMessage("");
    setItems([...files].map((file) => ({ file, requestId: crypto.randomUUID(), status: "선택됨", done: false })));
  }
  function update(requestId: string, status: string, done = false) {
    setItems((current) => current.map((item) => item.requestId === requestId ? { ...item, status, done } : item));
  }
  async function upload() {
    setBusy(true);
    for (const item of items.filter((item) => !item.done)) {
      try {
        if (!(item.file.type in formats)) throw new Error("JPEG·PNG·정적 WebP가 필요해요. HEIC는 변환 후 선택해주세요.");
        if (item.file.size > policy.maxBytes) throw new Error("10 MiB 이하 사진을 선택해주세요.");
        update(item.requestId, "업로드 준비 중…");
        const { reservations } = await requestApi<{ reservations: Reservation[] }>("/api/uploads", {
          method: "POST", body: JSON.stringify({ files: [{ original_name: item.file.name, mime_type: item.file.type,
            byte_size: item.file.size, client_request_id: item.requestId }] }),
        });
        const reserved = reservations[0];
        if (!reserved.already_ready) {
          update(item.requestId, "사진 전송 중…");
          const { error } = await createClient().storage.from(policy.bucket).upload(reserved.path!, item.file,
            { contentType: item.file.type, upsert: false, cacheControl: "0" });
          // 응답 유실로 객체가 이미 있으면 확정 API에서 실제 파일을 검증합니다.
          if (error && !/already exists|duplicate/i.test(error.message)) throw new Error("사진 전송에 실패했어요. 다시 시도해주세요.");
          update(item.requestId, "사진 확인 중…");
          await requestApi(`/api/uploads/${reserved.id}/complete`, { method: "POST" });
        }
        update(item.requestId, "사진을 추가했어요", true);
      } catch (error) { update(item.requestId, error instanceof Error ? error.message : "다시 시도해주세요."); }
    }
    setBusy(false);
  }
  return <><label htmlFor="photos">다시 보고 싶은 사진</label><input id="photos" type="file" multiple
    accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => select(e.target.files)} />
    <p>JPEG·PNG·정적 WebP를 지원해요. HEIC는 변환 후 선택해주세요.</p>
    <p>사진 업로드 완료 후 24시간 안에 첫 메모를, 첫 메모 후 48시간 안에 두 번째 메모를 남겨야 사진과 두 메모가 유지돼요. 기한을 넘기면 함께 삭제돼요.</p>
    <p>원본에 촬영 위치 등 EXIF 정보가 포함될 수 있어요. 원본은 비공개로 보관하고 화면용 사진에서는 EXIF를 제거해요.</p>
    <p>확정되지 않은 업로드는 24시간 후 정리할 수 있어요.</p>
    <p role="status">{message}</p><ul aria-live="polite">{items.map((item) => <li key={item.requestId}>{item.file.name}: {item.status}</li>)}</ul>
    <div className="actions"><button disabled={busy || !items.some((i) => !i.done)} onClick={() => void upload()}>{busy ? "사진 확인 중…" : "사진 추가 / 재시도"}</button>
      {items.some((i) => i.done) && <Link className="button" href="/revisit">사진 다시 보기</Link>}</div></>;
}
