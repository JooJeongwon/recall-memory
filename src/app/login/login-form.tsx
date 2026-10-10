"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ authError }: { authError: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(authError ? "Google 로그인이 완료되지 않았어요. 다시 시도해주세요." : "");

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) throw error;
    } catch {
      setMessage("Google 로그인을 시작하지 못했어요. OAuth 설정을 확인하고 다시 시도해주세요.");
    } finally { setBusy(false); }
  }

  return <>
    <div className="actions">
      <button type="button" disabled={busy} onClick={() => void signInWithGoogle()}>
        {busy ? "Google로 이동 중…" : "Google 계정으로 로그인"}
      </button>
    </div>
    <p role="status">{message}</p>
  </>;
}
