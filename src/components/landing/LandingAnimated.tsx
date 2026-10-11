"use client";
import Link from "next/link";
import Image from "next/image";
import { isDemoMode } from "@/lib/demo";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function LandingAnimated({ configured }: { configured: boolean }) {
  const shouldReduce = useReducedMotion();
  const collageRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: collageRef,
    offset: ["start start", "end start"],
  });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, shouldReduce ? 0 : -55]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, shouldReduce ? 0 : -32]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, shouldReduce ? 0 : -76]);

  const demoMode = isDemoMode();

  const fadeUp = (delay: number) =>
    shouldReduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.62, delay, ease },
        };

  return (
    <div className="landing-root">
      <motion.div
        className="landing-topbar"
        {...(shouldReduce ? {} : {
          initial: { opacity: 0, y: -14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease },
        })}
      >
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
      </motion.div>

      {/* Editorial photo collage */}
      <div className="landing-collage" aria-hidden="true" ref={collageRef}>
        <div className="landing-collage-inner">
          <motion.div
            className="landing-photo landing-photo-1"
            style={{ y: y1, rotate: -3.5 }}
            {...(shouldReduce ? {} : {
              initial: { opacity: 0, scale: 0.94, y: 22 },
              animate: { opacity: 1, scale: 1, y: 0 },
              transition: { duration: 0.8, delay: 0.08, ease },
            })}
          >
            <Image src="/terace.png" alt="" fill sizes="54vw" style={{ objectFit: "cover" }} priority />
          </motion.div>
          <motion.div
            className="landing-photo landing-photo-2"
            style={{ y: y2, rotate: 2.5 }}
            {...(shouldReduce ? {} : {
              initial: { opacity: 0, scale: 0.94, y: 22 },
              animate: { opacity: 1, scale: 1, y: 0 },
              transition: { duration: 0.8, delay: 0.2, ease },
            })}
          >
            <Image src="/gold.png" alt="" fill sizes="40vw" style={{ objectFit: "cover" }} priority />
          </motion.div>
          <motion.div
            className="landing-photo landing-photo-3"
            style={{ y: y3, rotate: -1.5 }}
            {...(shouldReduce ? {} : {
              initial: { opacity: 0, scale: 0.94, y: 22 },
              animate: { opacity: 1, scale: 1, y: 0 },
              transition: { duration: 0.8, delay: 0.32, ease },
            })}
          >
            <Image src="/images/editorial/romantic.png" alt="" fill sizes="38vw" style={{ objectFit: "cover", objectPosition: "center 35%" }} />
          </motion.div>
        </div>
      </div>

      {/* Hero text + CTA */}
      <div className="landing-content">
        <motion.h1 className="landing-heading" {...fadeUp(0.34)}>
          지나간 순간을,<br />다시 마주하다.
        </motion.h1>
        <motion.p className="landing-body" {...fadeUp(0.46)}>
          사진을 다시 보고,<br />오래 기억하고 싶은 순간을 남겨보세요.
        </motion.p>

        {!configured && (
          <motion.div className="connection-notice" {...fadeUp(0.52)}>
            <strong>데모 모드</strong>
            연결 설정 없이 UI를 둘러보고 있어요.
          </motion.div>
        )}

        <motion.div {...fadeUp(0.56)}>
          <Link
            className="button coral landing-cta"
            href={demoMode ? "/revisit" : "/login"}
            style={{ display: "flex", width: "100%" }}
          >
            <span style={{ flex: 1, textAlign: "center" }}>
              {demoMode ? "데모 화면 둘러보기" : "나의 기억 시작하기"}
            </span>
            <span className="landing-cta-arrow">→</span>
          </Link>

          <Link className="landing-secondary" href="/memories">
            지난 기억 둘러보기
          </Link>

          <p className="landing-note">
            첫 사진 업로드 후 48시간 · 최대 20장<br />
            JPEG · PNG · WebP
          </p>
        </motion.div>
      </div>
    </div>
  );
}
