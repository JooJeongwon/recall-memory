import Link from "next/link";
import { isConfigured } from "@/lib/config";
import { ConnectionNotice } from "@/components/connection-notice";

export default function Home() {
  return <><h1>사진 속 순간에<br />한 줄을 남겨보세요.</h1>
    <p>사진마다 한 줄 메모를 두 번 남기면 그 순간을 보관할 수 있어요.</p>
    <p>사진 업로드 완료 후 24시간 안에 첫 메모, 첫 메모 후 48시간 안에 두 번째 메모를 남겨야 해요. 기한을 넘기면 사진과 메모가 함께 삭제돼요.</p>
    <p>첫 사진을 올린 뒤 48시간 동안 사진을 추가할 수 있어요. 두 메모 기한을 지킨 사진은 기간이 끝나도 보고 가져갈 수 있어요.</p>
    <p>직접 선택한 사진만 복사해 받아요. 기기의 원본은 바뀌지 않아요.</p>
    <p>JPEG·PNG·정적 WebP를 지원해요. 사진당 10 MiB, 계정당 20장까지 선택할 수 있어요.</p>
    {!isConfigured() && <ConnectionNotice />}
    <Link className="button" href="/login">시작하기</Link></>;
}
