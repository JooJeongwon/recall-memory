"use client";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";

export function TrialNotice() {
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    requestApi<{ trial_state: string }>("/api/me")
      .then((me) => setEnded(me.trial_state === "ended"))
      .catch(() => {});
  }, []);

  if (!ended) return null;

  return (
    <div className="trial-notice">
      <div className="trial-dot" />
      <div>
        <strong>사진을 추가할 수 있는 기간이 종료되었어요.</strong>
        <p>이미 남긴 기억은 계속 확인하고 다운로드할 수 있어요.</p>
      </div>
    </div>
  );
}
