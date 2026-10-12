"use client";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
export function TrialNotice() {
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    requestApi<{ trial_state: string }>("/api/me").then((me) => setEnded(me.trial_state === "ended")).catch(() => {});
  }, []);
  return ended ? <aside className="notice">사진 추가 기간이 끝났어요. 두 메모 기한을 지킨 사진과 글은 보관함에서 계속 볼 수 있어요. 아직 메모 기한 안인 사진은 메모를 마칠 수 있어요.</aside> : null;
}
