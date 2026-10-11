import Image from "next/image";
import { LoginForm } from "./login-form";
import { isConfigured } from "@/lib/config";

/* Editorial stairway photo for login */
const LoginPhoto = () => (
  <svg viewBox="0 0 430 260" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
    <defs>
      <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#B8C8D4"/>
        <stop offset="100%" stopColor="#C8A870"/>
      </linearGradient>
      <linearGradient id="ls-wall" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#D4B888"/>
        <stop offset="100%" stopColor="#C8A870"/>
      </linearGradient>
    </defs>
    {/* Sky */}
    <rect width="430" height="260" fill="url(#ls-sky)"/>
    {/* Right building */}
    <rect x="260" y="0" width="170" height="260" fill="#E0CCA8" opacity=".85"/>
    <rect x="300" y="20" width="24" height="36" rx="3" fill="#8898A8" opacity=".6"/>
    <rect x="338" y="20" width="24" height="36" rx="3" fill="#8898A8" opacity=".6"/>
    <rect x="300" y="80" width="24" height="36" rx="3" fill="#8898A8" opacity=".55"/>
    <rect x="338" y="80" width="24" height="36" rx="3" fill="#8898A8" opacity=".55"/>
    {/* Left building */}
    <rect x="0" y="30" width="160" height="230" fill="#D0C0A0" opacity=".8"/>
    <rect x="20" y="60" width="24" height="36" rx="3" fill="#8898A8" opacity=".55"/>
    <rect x="60" y="60" width="24" height="36" rx="3" fill="#8898A8" opacity=".55"/>
    <rect x="20" y="120" width="24" height="36" rx="3" fill="#8898A8" opacity=".5"/>
    {/* Stairs - main pathway */}
    <rect x="140" y="100" width="150" height="12" rx="2" fill="#E8D8B8"/>
    <rect x="148" y="112" width="142" height="12" rx="2" fill="#E0CEB0"/>
    <rect x="156" y="124" width="134" height="12" rx="2" fill="#D8C4A8"/>
    <rect x="164" y="136" width="126" height="12" rx="2" fill="#D0BAA0"/>
    <rect x="172" y="148" width="118" height="12" rx="2" fill="#C8B098"/>
    <rect x="180" y="160" width="110" height="12" rx="2" fill="#C0A890"/>
    <rect x="188" y="172" width="102" height="12" rx="2" fill="#B8A088"/>
    <rect x="196" y="184" width="94" height="12" rx="2" fill="#B09880"/>
    <rect x="204" y="196" width="86" height="12" rx="2" fill="#A89080"/>
    <rect x="212" y="208" width="78" height="52" rx="2" fill="#A08878"/>
    {/* Center arch/doorway */}
    <rect x="195" y="30" width="40" height="70" rx="20" fill="#6A5040" opacity=".6"/>
    <rect x="200" y="40" width="30" height="60" rx="15" fill="#4A3020" opacity=".7"/>
    {/* Plants */}
    <ellipse cx="145" cy="220" rx="22" ry="28" fill="#7A9868" opacity=".8"/>
    <ellipse cx="128" cy="235" rx="16" ry="20" fill="#6A8858" opacity=".75"/>
    <ellipse cx="165" cy="230" rx="14" ry="18" fill="#80A070" opacity=".7"/>
    <ellipse cx="285" cy="215" rx="18" ry="22" fill="#7A9868" opacity=".75"/>
    <ellipse cx="305" cy="228" rx="14" ry="18" fill="#6A8858" opacity=".7"/>
    {/* Light warmth overlay */}
    <rect x="180" y="0" width="100" height="100" fill="#F0D890" opacity=".2"/>
    {/* Ground path */}
    <ellipse cx="260" cy="245" rx="80" ry="15" fill="#B0A090" opacity=".4"/>
  </svg>
);

export default function Login() {
  return (
    <div className="login-root">
      {/* Cinematic photo strip at top */}
      <div className="login-photo-strip">
        <LoginPhoto />
      </div>

      {/* Form content */}
      <div className="login-content">
        <Image
          src="/branding/text-logo.png"
          alt="기억할 권리"
          width={2172}
          height={724}
          className="landing-brand-logo"
          style={{ marginBottom: 6 }}
          unoptimized
        />
        <p className="login-tagline">A MUSEUM OF MY MOMENTS</p>

        <h1 className="login-heading">
          이메일로<br />시작해요.
        </h1>
        <p className="login-sub">
          계정이 없으면, 이메일로<br />인증 후 바로 이용할 수 있어요.
        </p>

        {isConfigured() ? <LoginForm /> : (
          <div style={{ padding: "20px 0" }}>
            <p style={{ color: "var(--c-muted)", fontSize: ".88rem" }}>
              Supabase 연결 설정이 필요합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
