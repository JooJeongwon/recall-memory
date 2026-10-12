"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isDemoMode } from "@/lib/demo";
import { requestApi } from "@/lib/api";
export function DeletePhoto({ id, onDeleted, compact = false }: { id: string; onDeleted?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function remove() {
    if (!window.confirm("사진과 메모가 화면에서 삭제됩니다. 데이터는 복구를 위해 서비스에 보관됩니다. 계속할까요?")) return;
    if (isDemoMode()) { setMessage("데모 모드에서는 삭제할 수 없어요."); return; }
    setMessage("");
    setPending(true);
    try {
      await requestApi(`/api/photos/${id}`, { method: "DELETE" });
      if (onDeleted) onDeleted();
      else router.replace("/memories");
    } catch (e) {
      setPending(false);
      setMessage(e instanceof Error ? e.message : "다시 시도해주세요.");
    }
  }
  return <div><button className={compact ? "photo-detail-action danger" : "danger"} disabled={pending} onClick={() => void remove()}>사진 삭제</button>
    <p role="status">{message || (pending ? "삭제 처리 중이에요." : "")}</p></div>;
}
