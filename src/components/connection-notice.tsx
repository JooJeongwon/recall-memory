export function ConnectionNotice() {
  return <aside className="notice" role="status">
    <strong>개발 환경 미연결</strong>
    <p>Supabase 환경변수와 DB 설정이 필요합니다. 이 상태에서는 사진과 메모를 저장할 수 없어요.</p>
  </aside>;
}
