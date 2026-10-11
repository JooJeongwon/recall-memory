"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Phase = "init" | "black" | "icon-reveal" | "portal" | "artwork" | "exit" | "done";

const SESSION_KEY = "recall-memory:intro-seen";
const ICON_SRC = "/branding/app-icon.png";
const ARTWORK_SRC = "/branding/opening-artwork.png";

export function OpeningSplash() {
  const [phase, setPhase] = useState<Phase>("init");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = useRef(false);

  function push(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }

  function cancelAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function go(p: Phase) {
    if (alive.current) setPhase(p);
  }

  function skip() {
    cancelAll();
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    go("exit");
    push(() => go("done"), 350);
  }

  useEffect(() => {
    alive.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try { seen = !!sessionStorage.getItem(SESSION_KEY); } catch {}

    if (reduced || seen) {
      push(() => go("done"), 0);
      return () => { alive.current = false; cancelAll(); };
    }

    // Dark screen confirmed — start preloading
    push(() => go("black"), 0);

    let started = false;
    function runTimeline() {
      if (started || !alive.current) return;
      started = true;
      push(() => go("icon-reveal"), 200);
      push(() => go("portal"),      700);
      push(() => go("artwork"),     1300);
      push(() => {
        go("exit");
        try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
      }, 1850);
      push(() => go("done"), 2400);
    }

    // Preload both images in parallel; start after both ready or 500ms timeout
    let loaded = 0;
    function onAsset() {
      if (++loaded >= 2) runTimeline();
    }
    const iconEl = new window.Image();
    const artworkEl = new window.Image();
    iconEl.onload = iconEl.onerror = onAsset;
    artworkEl.onload = artworkEl.onerror = onAsset;
    iconEl.src = ICON_SRC;
    artworkEl.src = ARTWORK_SRC;

    // Hard fallback: start regardless after 500ms
    push(runTimeline, 500);

    return () => {
      alive.current = false;
      cancelAll();
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className="splash-overlay"
      data-phase={phase}
      data-testid="opening-splash"
      aria-hidden="true"
    >
      {/* Skip */}
      <button
        className="splash-skip"
        onClick={skip}
        data-testid="opening-skip"
        type="button"
        aria-label="애니메이션 건너뛰기"
      >
        건너뛰기
      </button>

      {/* App icon — centered, slightly above middle */}
      <div className="splash-icon-wrap" data-testid="opening-icon">
        <div className="splash-icon-frame">
          <Image
            src={ICON_SRC}
            alt="기억할 권리"
            fill
            style={{ objectFit: "cover" }}
            priority
            unoptimized
            sizes="88px"
          />
        </div>
      </div>

      {/* Cinematic opening artwork — full screen */}
      <div className="splash-artwork-wrap" data-testid="opening-artwork">
        <Image
          src={ARTWORK_SRC}
          alt=""
          fill
          style={{ objectFit: "cover" }}
          priority
          unoptimized
          sizes="100vw"
        />
      </div>
    </div>
  );
}
