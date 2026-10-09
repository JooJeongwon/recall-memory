"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestApi } from "@/lib/api";

export function SettingsForm() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    requestApi<{ profile: { analytics_consent: boolean } }>("/api/me").then((me) => {
      setConsent(me.profile.analytics_consent); setLoaded(true);
    }).catch((e: Error) => setMessage(e.message));
  }, []);
  async function save() {
    setBusy(true);
    try { await requestApi("/api/me/preferences", { method: "PATCH", body: JSON.stringify({ analytics_consent: consent, timezone: "Asia/Seoul" }) }); setMessage("설정을 저장했어요."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }
  async function logout() {
    const { error } = await createClient().auth.signOut();
    if (error) { setMessage("로그아웃하지 못했어요. 다시 시도해주세요."); return; }
    router.replace("/login"); router.refresh();
  }
  async function deleteAccount() {
    if (!window.confirm("계정과 모든 사진·메모가 삭제됩니다. 필요한 사진을 먼저 가져가세요. 삭제할까요?")) return;
    setBusy(true);
    try {
      const job = await requestApi<{ job_id: string; progress_token: string; expires_at: string }>("/api/me", { method: "DELETE" });
      sessionStorage.setItem("deletion-progress", JSON.stringify(job)); router.replace("/settings/deletion"); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "다시 시도해주세요."); }
    finally { setBusy(false); }
  }
  return <><label><input type="checkbox" checked={consent} disabled={!loaded || busy} onChange={(e) => setConsent(e.target.checked)} />사용 행동 분석에 동의</label>
    <p>동의하지 않아도 같은 기능을 이용할 수 있어요. 사진·메모·파일명은 분석 기록에 포함하지 않아요. 철회하면 기존 행동 기록도 지워요.</p>
    <div className="actions"><button disabled={!loaded || busy} onClick={() => void save()}>설정 저장</button>
      <button className="secondary" disabled={busy} onClick={() => void logout()}>로그아웃</button>
      <button className="danger" disabled={busy} onClick={() => void deleteAccount()}>계정과 전체 데이터 삭제</button></div><p role="status">{message}</p></>;
}
