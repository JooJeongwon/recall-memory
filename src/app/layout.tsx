import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "기억할 권리", description: "사진 속 순간에 한 줄을 남겨보세요." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>
    <a className="skip" href="#main">본문으로 이동</a>
    <header><Link href="/">기억할 권리</Link></header>
    <main id="main">{children}</main>
    <nav aria-label="주요 메뉴"><Link href="/start" prefetch={false}>사진 선택</Link>
      <Link href="/revisit" prefetch={false}>다시 보기</Link><Link href="/memories" prefetch={false}>보관함</Link>
      <Link href="/settings" prefetch={false}>설정</Link></nav>
  </body></html>;
}
