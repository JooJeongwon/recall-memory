"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { requestApi } from "@/lib/api";
import { formats, policy } from "@/lib/config";
import { isDemoMode } from "@/lib/demo";

type Item = {
  file: File;
  requestId: string;
  status: string;
  done: boolean;
  preview: string;
  error: boolean;
};
type Reservation = { id: string; path?: string; token?: string; already_ready: boolean };

export function UploadForm() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { items.forEach((i) => URL.revokeObjectURL(i.preview)); };
  }, [items]);

  function buildItems(files: File[]): Item[] {
    return files.map((file) => ({
      file,
      requestId: crypto.randomUUID(),
      status: "선택됨",
      done: false,
      preview: URL.createObjectURL(file),
      error: false,
    }));
  }

  function select(files: FileList | null) {
    if (!files) return;
    if (files.length > policy.maxBatch) { setMessage(`한 번에 ${policy.maxBatch}장까지 선택해주세요.`); return; }
    setMessage("");
    items.forEach((i) => URL.revokeObjectURL(i.preview));
    setItems(buildItems([...files]));
    setDoneCount(0);
  }

  function removeItem(requestId: string) {
    setItems((curr) => {
      const item = curr.find((i) => i.requestId === requestId);
      if (item) URL.revokeObjectURL(item.preview);
      return curr.filter((i) => i.requestId !== requestId);
    });
  }

  function update(requestId: string, status: string, done = false, error = false) {
    setItems((curr) =>
      curr.map((item) => item.requestId === requestId ? { ...item, status, done, error } : item)
    );
    if (done) setDoneCount((n) => n + 1);
  }

  async function upload() {
    setBusy(true);
    setUploading(true);
    setDoneCount(0);
    for (const item of items.filter((i) => !i.done)) {
      try {
        if (!(item.file.type in formats)) throw new Error("JPEG·PNG·정적 WebP가 필요해요. HEIC는 변환 후 선택해주세요.");
        if (item.file.size > policy.maxBytes) throw new Error("10 MiB 이하 사진을 선택해주세요.");
        update(item.requestId, "이미지 검증 완료");

        if (isDemoMode()) {
          await new Promise((r) => setTimeout(r, 600));
          update(item.requestId, "추가됨", true, false);
          continue;
        }

        update(item.requestId, "업로드 중…");
        const { reservations } = await requestApi<{ reservations: Reservation[] }>("/api/uploads", {
          method: "POST",
          body: JSON.stringify({
            files: [{ original_name: item.file.name, mime_type: item.file.type,
              byte_size: item.file.size, client_request_id: item.requestId }],
          }),
        });
        const reserved = reservations[0];
        if (!reserved.already_ready) {
          const { error } = await createClient().storage
            .from(policy.bucket)
            .uploadToSignedUrl(reserved.path!, reserved.token!, item.file);
          if (error && !/already exists|duplicate/i.test(error.message))
            throw new Error("사진 전송에 실패했어요. 다시 시도해주세요.");
          update(item.requestId, "서버 저장 중…");
          await requestApi(`/api/uploads/${reserved.id}/complete`, { method: "POST" });
        }
        update(item.requestId, "저장 완료", true, false);
      } catch (error) {
        update(item.requestId, error instanceof Error ? error.message : "다시 시도해주세요.", false, true);
      }
    }
    setBusy(false);
  }

  const hasItems = items.length > 0;
  const allDone = hasItems && items.every((i) => i.done);
  const canUpload = hasItems && !busy && items.some((i) => !i.done);
  const progress = hasItems ? Math.round((doneCount / items.length) * 100) : 0;

  /* Upload progress view */
  if (uploading && hasItems) {
    return (
      <>
        <div className="upload-progress-header">
          <p className="upload-progress-title">사진 업로드 중</p>
          <p className="upload-progress-sub">선택한 사진을 안전하게 업로드하고 있습니다.</p>
        </div>

        <div className="upload-progress-count">
          {doneCount} / {items.length}
        </div>

        <div className="upload-progress-bar-wrap">
          <div className="upload-progress-bar">
            <div className="upload-progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="upload-progress-pct">{progress}%</span>
        </div>

        <div className="upload-status-list">
          {items.map((item, i) => {
            const isDone = item.done;
            const isActive = !item.done && !item.error && item.status !== "선택됨";
            const stageLabel = item.error
              ? item.status
              : item.done
              ? "저장 완료"
              : isActive
              ? item.status
              : "대기 중";
            return (
              <div key={item.requestId} className={`upload-status-item${isDone ? " done" : ""}`}>
                <div className="upload-status-icon">
                  {isDone && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {isActive && !isDone && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-coral)", animation: "none" }} />
                  )}
                </div>
                <span style={{ flex: 1, fontSize: ".84rem" }}>
                  {item.file.name.length > 24 ? item.file.name.slice(0, 24) + "…" : item.file.name}
                </span>
                <span style={{ fontSize: ".78rem", color: item.error ? "var(--c-danger)" : isDone ? "var(--c-coral)" : "var(--c-muted)" }}>
                  {stageLabel}
                </span>
              </div>
            );
          })}
        </div>

        {allDone && (
          <div className="actions" style={{ marginTop: 32, flexDirection: "column" }}>
            <Link className="button coral" href="/revisit" style={{ width: "100%", justifyContent: "center" }}>
              사진 다시 보기 →
            </Link>
            <button className="ghost" style={{ width: "100%" }} onClick={() => {
              items.forEach((i) => URL.revokeObjectURL(i.preview));
              setItems([]); setDoneCount(0); setUploading(false); setBusy(false);
            }}>
              더 추가하기
            </button>
          </div>
        )}

        {!allDone && busy && (
          <div style={{ marginTop: 32 }}>
            <p style={{ fontSize: ".8rem", color: "var(--c-muted)", textAlign: "center" }}>
              업로드가 완료될 때까지 앱을 닫지 마세요.
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Drop zone */}
      {!hasItems && (
        <div
          className={`upload-zone${dragOver ? " drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            select(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            id="photos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => select(e.target.files)}
            style={{ display: "none" }}
          />
          <svg className="upload-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p className="upload-zone-text">
            <strong>사진을 끌어다 놓거나 클릭하세요</strong>
            JPEG · PNG · WebP · 최대 10장 · 10 MiB
          </p>
        </div>
      )}

      {/* Selected photos preview */}
      {hasItems && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: ".88rem", fontWeight: 600, color: "var(--c-text)" }}>
              {items.length}장 선택됨
            </span>
            <button
              className="ghost"
              style={{ fontSize: ".78rem", padding: "6px 14px", height: 36, minHeight: 36 }}
              onClick={() => {
                items.forEach((i) => URL.revokeObjectURL(i.preview));
                setItems([]); setMessage(""); setDoneCount(0);
              }}
            >
              다시 선택
            </button>
          </div>

          <div className="upload-previews" aria-live="polite" aria-label="선택된 사진 목록">
            {items.map((item) => (
              <div key={item.requestId} className="upload-preview-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.preview} alt={item.file.name} loading="lazy" />
                <div className={`upload-preview-badge${item.done ? " done" : item.error ? " error" : ""}`}>
                  <span>{item.done ? "✓" : item.error ? "✕" : item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {message && (
        <p className="error" role="alert" style={{ marginTop: 12 }}>{message}</p>
      )}

      <div className="actions" style={{ marginTop: 20 }}>
        {hasItems && !allDone && (
          <button
            className="coral"
            disabled={!canUpload}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => void upload()}
          >
            {busy ? "업로드 중…" : "사진 추가하기"}
          </button>
        )}
        {allDone && (
          <Link className="button" href="/revisit" style={{ flex: 1, justifyContent: "center" }}>
            사진 다시 보기 →
          </Link>
        )}
      </div>

      <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--c-border)" }}>
        <p style={{ fontSize: ".76rem", color: "var(--c-muted)", lineHeight: 1.65 }}>
          HEIC 파일은 변환 후 선택해주세요. 원본은 비공개로 보관하며 화면용 사진에서는 EXIF를 제거해요.
        </p>
      </div>
    </>
  );
}
