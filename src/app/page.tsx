import Link from "next/link";
import Image from "next/image";
import { isConfigured } from "@/lib/config";
import { isDemoMode } from "@/lib/demo";
import { OpeningSplash } from "@/components/branding/OpeningSplash";

export default function Home() {
  return (
    <>
    <OpeningSplash />
    <div className="landing-root">
      {/* Brand top bar */}
      <div className="landing-topbar">
        <Image
          src="/branding/text-logo.png"
          alt="기억할 권리"
          width={2172}
          height={724}
          className="landing-brand-logo"
          priority
          unoptimized
        />
        <span className="landing-tagline">A MUSEUM<br />OF MY MOMENTS</span>
      </div>

      {/* Editorial photo collage */}
      <div className="landing-collage" aria-hidden="true">
        <div className="landing-collage-inner">
          <div className="landing-photo landing-photo-1">
            <Image src="/terace.png" alt="" fill sizes="54vw" style={{ objectFit: "cover" }} priority />
          </div>
          <div className="landing-photo landing-photo-2">
            <Image src="/gold.png" alt="" fill sizes="40vw" style={{ objectFit: "cover" }} priority />
          </div>
          <div className="landing-photo landing-photo-3">
            <Image src="/images/editorial/romantic.png" alt="" fill sizes="38vw" style={{ objectFit: "cover", objectPosition: "center 35%" }} />
          </div>
        </div>
      </div>

      {/* Hero text + CTA */}
      <div className="landing-content">
        <h1 className="landing-heading">
          지나간 순간을,<br />다시 마주하다.
        </h1>
        <p className="landing-body">
          사진을 다시 보고,<br />오래 기억하고 싶은 순간을 남겨보세요.
        </p>

        {!isConfigured() && (
          <div className="connection-notice">
            <strong>데모 모드</strong>
            연결 설정 없이 UI를 둘러보고 있어요.
          </div>
        )}

        <Link
          className="button coral landing-cta"
          href={isDemoMode() ? "/revisit" : "/login"}
          style={{ display: "flex", width: "100%" }}
        >
          <span style={{ flex: 1, textAlign: "center" }}>
            {isDemoMode() ? "데모 화면 둘러보기" : "나의 기억 시작하기"}
          </span>
          <span style={{ marginLeft: 4, transition: "transform 200ms cubic-bezier(0.22,1,0.36,1)" }}
            className="landing-cta-arrow">→</span>
        </Link>

        <Link className="landing-secondary" href="/memories">
          지난 기억 둘러보기
        </Link>

        <p className="landing-note">
          첫 사진 업로드 후 48시간 · 최대 20장<br />
          JPEG · PNG · WebP
        </p>
      </div>
    </div>
    </>
  );
}
