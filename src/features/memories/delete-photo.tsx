"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestApi } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";

export function DeletePhoto({ id, compact }: { id: string; compact?: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function remove() {
    if (!window.confirm("사진과 메모가 함께 삭제됩니다. 필요하면 먼저 가져가세요. 삭제할까요?")) return;
    if (isDemoMode()) {
      setMessage("데모 모드에서는 삭제할 수 없어요.");
      return;
    }
    try {
      await requestApi(`/api/photos/${id}`, { method: "DELETE" });
      setPending(true);
      setMessage("삭제 요청을 접수했어요.");
      setTimeout(() => router.push("/memories"), 1200);
    } catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
  }

  if (compact) {
    return (
      <>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" onClick={() => !pending && void remove()} style={{ cursor: pending ? "not-allowed" : "pointer" }}>
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
        </svg>
        <span style={{ fontSize: ".72rem", color: "var(--c-danger)", fontWeight: 600 }}>
          {pending ? "삭제됨" : "삭제하기"}
        </span>
        {message && <p style={{ fontSize: ".7rem", color: "var(--c-muted)", marginTop: 2 }}>{message}</p>}
      </>
    );
  }

  return (
    <div>
      <button className="danger" disabled={pending} onClick={() => void remove()}>
        사진 삭제
      </button>
      {message && (
        <p role="status" style={{ marginTop: 8, fontSize: ".82rem", color: "var(--c-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
