"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestApi } from "@/lib/api";
import { isDemoMode } from "@/lib/demo";
import { createBulkArchive, fetchArchiveItem, saveArchive } from "@/features/export/archive";

export function SettingsForm() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState("");

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  useEffect(() => {
    requestApi<{ profile: { analytics_consent: boolean } }>("/api/me")
      .then((me) => { setConsent(me.profile.analytics_consent); setLoaded(true); })
      .catch((e: Error) => setMessage(e.message));

    if (!isDemoMode()) {
      createClient().auth.getUser().then(({ data }) => {
        if (data.user?.email) setEmail(data.user.email);
      }).catch(() => {});
    } else {
      setTimeout(() => { setEmail("user@example.com"); setLoaded(true); }, 0);
    }
  }, []);

  async function save() {
    setBusy(true);
    try {
      await requestApi("/api/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({ analytics_consent: consent, timezone: "Asia/Seoul" }),
      });
      showToast("동의 설정을 저장했어요.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!isDemoMode()) {
      const { error } = await createClient().auth.signOut();
      if (error) { setMessage("로그아웃하지 못했어요. 다시 시도해주세요."); return; }
    }
    router.replace("/login"); router.refresh();
  }

  async function deleteAccount() {
    if (isDemoMode()) { setMessage("데모 모드에서는 삭제할 수 없어요."); return; }
    if (!window.confirm("계정과 모든 사진·메모가 삭제됩니다. 필요한 사진을 먼저 가져가세요. 삭제할까요?")) return;
    setBusy(true);
    try {
      const job = await requestApi<{ job_id: string; progress_token: string; expires_at: string }>("/api/me", { method: "DELETE" });
      sessionStorage.setItem("deletion-progress", JSON.stringify(job));
      router.replace("/settings/deletion"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  async function exportAll() {
    if (exporting) return;
    if (isDemoMode()) { setMessage("데모 모드에서는 다운로드할 수 없어요."); return; }
    setExporting(true);
    setMessage("");
    try {
      const { photos } = await requestApi<{ photos: { id: string }[] }>("/api/photos?scope=preserved&limit=20");
      if (!photos.length) throw new Error("보관된 사진이 아직 없어요.");
      const items = [];
      // shortcut: MVP는 계정당 최대 20장, 한도를 늘리면 ZIP 스트리밍으로 변경합니다.
      for (const photo of photos) items.push(await fetchArchiveItem(photo.id));
      saveArchive(createBulkArchive(items), `memories-${new Date().toISOString().slice(0, 10)}.zip`);
      showToast("다운로드를 시작했어요.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "다운로드에 실패했어요.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="settings-root">
      {/* Toast notification */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: "env(safe-area-inset-top, 0px)",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 9999,
          pointerEvents: "none",
          padding: "12px 16px 0",
          transition: "opacity 0.25s, transform 0.25s",
          opacity: toastVisible ? 1 : 0,
          transform: toastVisible ? "translateY(0)" : "translateY(-8px)",
        }}
      >
        {toast && (
          <div style={{
            background: "var(--c-fg, #111)",
            color: "var(--c-bg, #fff)",
            borderRadius: 12,
            padding: "10px 18px",
            fontSize: ".88rem",
            fontWeight: 500,
            boxShadow: "0 4px 16px rgba(0,0,0,.18)",
            maxWidth: 280,
            textAlign: "center",
          }}>
            {toast}
          </div>
        )}
      </div>
      {/* Profile */}
      <div className="settings-profile-row">
        <div className="settings-profile-left">
          <div className="settings-avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="settings-profile-name">{email.split("@")[0] || "—"}</p>
            <p className="settings-profile-email">{email || "—"}</p>
          </div>
        </div>
        <svg className="settings-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>

      {/* Analytics consent */}
      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-row-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div className="settings-row-text">
            <strong>분석 데이터 사용 동의</strong>
            <p>사진·메모·파일명은 포함하지 않아요.</p>
          </div>
          <div className="settings-row-right">
            <button
              className={`settings-toggle${consent ? " on" : ""}`}
              role="switch"
              aria-label="분석 데이터 사용 동의"
              aria-checked={consent}
              disabled={!loaded || busy}
              onClick={() => setConsent((v) => !v)}
            >
              <div className="settings-toggle-thumb" />
            </button>
          </div>
        </div>
      </div>

      {/* Save consent */}
      {loaded && (
        <div style={{ marginBottom: 10 }}>
          <button
            style={{ width: "100%", background: "var(--c-btn)", color: "#fff", borderRadius: "var(--r-pill)", height: 44, minHeight: 44 }}
            disabled={!loaded || busy}
            onClick={() => void save()}
          >
            동의 설정 저장
          </button>
        </div>
      )}

      {/* Data */}
      <div className="settings-section">
        <div
          className="settings-row"
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer" }}
          onClick={() => void exportAll()}
          onKeyDown={(e) => e.key === "Enter" && void exportAll()}
          aria-disabled={exporting}
        >
          <div className="settings-row-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div className="settings-row-text">
            <strong>데이터 내보내기</strong>
            <p>{exporting ? "다운로드 준비 중…" : "보관된 사진과 메모를 ZIP으로 다운로드"}</p>
          </div>
          <div className="settings-row-right">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="settings-section">
        <div
          className="settings-row"
          role="button"
          tabIndex={0}
          onClick={() => void logout()}
          onKeyDown={(e) => e.key === "Enter" && void logout()}
        >
          <div className="settings-row-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div className="settings-row-text">
            <strong>로그아웃</strong>
          </div>
          <div className="settings-row-right">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      </div>

      <button className="danger" disabled={busy} onClick={() => void deleteAccount()}>계정과 전체 데이터 삭제</button>

      {message && (
        <p
          role="status"
          style={{
            marginTop: 12, fontSize: ".84rem",
            color: message.includes("못") || message.includes("없") ? "var(--c-danger)" : "var(--c-sub)",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
