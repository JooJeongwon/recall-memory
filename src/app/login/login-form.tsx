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
      setSent(true);
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); void (sent ? verify() : send()); }}>
      {!sent ? (
        <>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="이메일을 입력하세요"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            style={{ marginBottom: 12 }}
          />
          <button
            type="submit"
            className="login-btn"
            disabled={busy || !email}
          >
            {busy ? "전송 중…" : "인증번호 보내기"}
          </button>
        </>
      ) : (
        <>
          <div style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
            marginBottom: 12,
            fontSize: ".84rem",
            color: "var(--c-sub)",
          }}>
            <strong style={{ color: "var(--c-text)", display: "block", marginBottom: 2, fontSize: ".9rem" }}>
              {email}
            </strong>
            이메일로 인증번호를 보냈어요. 메일함을 확인해주세요.
          </div>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{6,10}"
            placeholder="인증번호 6자리"
            style={{ letterSpacing: ".2em", fontSize: "1.1rem", textAlign: "center", marginBottom: 12 }}
            className="login-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            type="submit"
            className="login-btn"
            disabled={busy || token.length < 6}
          >
            {busy ? "확인 중…" : "로그인"}
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              className="ghost"
              style={{ flex: 1, height: 44, minHeight: 44, fontSize: ".84rem" }}
              type="button"
              disabled={busy}
              onClick={() => void send()}
            >
              다시 보내기
            </button>
            <button
              className="ghost"
              style={{ flex: 1, height: 44, minHeight: 44, fontSize: ".84rem" }}
              type="button"
              disabled={busy}
              onClick={() => { setSent(false); setToken(""); setMessage(""); }}
            >
              주소 변경
            </button>
          </div>
        </>
      )}

      {message && (
        <p className="error" role="alert" style={{ marginTop: 12 }}>{message}</p>
      )}

      <p className="login-privacy" style={{ marginTop: 20 }}>
        계속하면 이용약관과{" "}
        <a href="#">개인정보처리방침</a>에
        동의하는 것으로 간주됩니다.
      </p>
    </form>
  );
}
