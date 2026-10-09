"use client";
import { useState } from "react";
import { requestApi } from "@/lib/api";
export function DeletePhoto({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function remove() {
    if (!window.confirm("사진과 메모가 함께 삭제됩니다. 필요하면 먼저 가져가세요. 삭제할까요?")) return;
    try {
      await requestApi(`/api/photos/${id}`, { method: "DELETE" }); setPending(true);
      setMessage("삭제 요청을 접수했어요. 파일 삭제가 진행 중이에요.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
  }
  return <div><button className="danger" disabled={pending} onClick={() => void remove()}>사진 삭제</button><p role="status">{message}</p></div>;
}
