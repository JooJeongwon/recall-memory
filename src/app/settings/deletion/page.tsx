"use client";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
export default function DeletionProgress() {
  const [message, setMessage] = useState("삭제 상태를 확인하는 중…");
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const raw = sessionStorage.getItem("deletion-progress");
        if (!raw) { setMessage("이 탭에 진행 확인 권한이 없어요."); return; }
        const job = JSON.parse(raw) as { job_id: string; progress_token: string; expires_at: string };
        if (Date.now() >= Date.parse(job.expires_at)) { sessionStorage.removeItem("deletion-progress"); setMessage("진행 확인 권한이 만료됐어요. 삭제 작업은 계속 진행돼요."); return; }
        const result = await requestApi<{ status: string }>(`/api/deletions/${job.job_id}`, { headers: { Authorization: `Bearer ${job.progress_token}` } });
        if (stopped) return;
        setMessage(result.status === "done" ? "계정과 데이터가 삭제됐어요." : result.status === "failed" ? "삭제 작업 재시도에 실패했어요. 운영 확인이 필요해요." : "사진과 데이터 삭제가 진행 중이에요.");
        if (result.status === "done") sessionStorage.removeItem("deletion-progress");
        else if (result.status !== "failed") timer = setTimeout(() => void poll(), 15_000);
      } catch { if (!stopped) { setMessage("진행 상태를 확인하지 못했어요. 다시 확인할게요."); timer = setTimeout(() => void poll(), 15_000); } }
    }
    void poll(); return () => { stopped = true; clearTimeout(timer); };
  }, []);
  return <><h1>계정 삭제</h1><p role="status">{message}</p></>;
}
