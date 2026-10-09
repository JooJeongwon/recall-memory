"use client";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
export function TrialNotice() {
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    requestApi<{ trial_state: string }>("/api/me").then((me) => setEnded(me.trial_state === "ended")).catch(() => {});
  }, []);
  return ended ? <aside className="notice">이번 다시 보기 기간이 끝났어요. 남긴 사진과 글은 보관함에서 계속 볼 수 있어요. 기존 사진에 메모를 남기거나 가져갈 수도 있어요.</aside> : null;
}
