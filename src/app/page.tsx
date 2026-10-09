import Link from "next/link";
import { isConfigured } from "@/lib/config";
import { ConnectionNotice } from "@/components/connection-notice";

export default function Home() {
  return <><h1>사진 속 순간에<br />한 줄을 남겨보세요.</h1>
    <p>다시 본 사진에서 기억하고 싶은 의미를 골라 남길 수 있어요.</p>
    <p>첫 사진을 올린 뒤 48시간 동안 사진을 추가할 수 있어요. 기간이 끝나도 기존 사진과 글은 계속 보고 가져갈 수 있어요.</p>
    <p>직접 선택한 사진만 복사해 받아요. 기기의 원본은 바뀌지 않아요.</p>
    <p>JPEG·PNG·정적 WebP를 지원해요. 사진당 10 MiB, 계정당 20장까지 선택할 수 있어요.</p>
    {!isConfigured() && <ConnectionNotice />}
    <Link className="button" href="/login">시작하기</Link></>;
}
