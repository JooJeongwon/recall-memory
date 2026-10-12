"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { nextVisit, visitPage, visitStorageKey } from "@/lib/analytics";

export function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    const page = visitPage(path);
    if (!page || process.env.NODE_ENV !== "production" || navigator.webdriver || navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl || ["localhost", "127.0.0.1"].includes(location.hostname)) return;
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(visitStorageKey); } catch { /* 저장소 없이도 현재 화면 방문은 집계합니다. */ }
    const { session, ...visit } = nextVisit(page, new URL(location.href), document.referrer, stored, Date.now());
    try { sessionStorage.setItem(visitStorageKey, session); } catch { /* 저장소 차단 시 다음 화면은 별도 세션입니다. */ }
    const body = JSON.stringify(visit);
    let timer: ReturnType<typeof setTimeout>;
    const send = async (retry: boolean) => {
      try {
        const response = await fetch("/api/analytics/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
        if (!response.ok && (response.status >= 500 || response.status === 429)) throw new Error("retry");
      } catch { if (retry) timer = setTimeout(() => void send(false), 2000); }
    };
    // Strict Mode의 effect 재실행을 실제 페이지 방문으로 두 번 세지 않습니다.
    timer = setTimeout(() => void send(true), 0);
    return () => clearTimeout(timer);
  }, [path]);
  return null;
}
