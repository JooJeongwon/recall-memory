"use client";
import { useState } from "react";
import { requestApi } from "@/lib/api";
export function DeletePhoto({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function remove() {
    if (!window.confirm("사진과 메모가 화면에서 삭제됩니다. 데이터는 복구를 위해 서비스에 보관됩니다. 계속할까요?")) return;
    setMessage("");
    setPending(true);
    try {
      await requestApi(`/api/photos/${id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setPending(false);
      setMessage(e instanceof Error ? e.message : "다시 시도해주세요.");
    }
  }
  return <div><button className="danger" disabled={pending} onClick={() => void remove()}>사진 삭제</button>
    <p role="status">{message || (pending ? "삭제 처리 중이에요." : "")}</p></div>;
}
