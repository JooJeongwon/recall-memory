"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send() {
    setBusy(true); setMessage("");
    try {
      const { error } = await createClient().auth.signInWithOtp({ email, options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      } });
      if (error) throw error;
      setSent(true); setMessage("이메일에서 로그인 링크를 누르거나, 인증번호가 도착한 경우 아래에 입력해주세요.");
    } catch { setMessage("메일을 보내지 못했어요. 주소를 확인하고 잠시 후 다시 시도해주세요."); }
    finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setMessage("");
    try {
      const { error } = await createClient().auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;
      router.replace("/start"); router.refresh();
    } catch { setMessage("인증번호가 올바르지 않거나 만료됐어요. 다시 확인해주세요."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(e) => { e.preventDefault(); void (sent ? verify() : send()); }}>
    <label htmlFor="email">이메일</label><input id="email" type="email" autoComplete="email" required
      value={email} disabled={sent || busy} onChange={(e) => setEmail(e.target.value)} />
    {sent && <><label htmlFor="otp">인증번호</label><input id="otp" inputMode="numeric" autoComplete="one-time-code"
      required pattern="[0-9]{6,10}" value={token} onChange={(e) => setToken(e.target.value)} /></>}
    <div className="actions"><button disabled={busy}>{busy ? "확인 중…" : sent ? "로그인" : "인증번호 받기"}</button>
      {sent && <><button className="secondary" type="button" disabled={busy} onClick={() => void send()}>다시 보내기</button>
        <button className="secondary" type="button" disabled={busy} onClick={() => { setSent(false); setToken(""); }}>주소 바꾸기</button></>}
    </div><p role="status">{message}</p>
  </form>;
}
