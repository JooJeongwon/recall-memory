"use client";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
import { accountReportSchema, type AccountReport } from "@/lib/analytics";

const actionNames: Record<string, string> = {
  trial_started: "사진 사용 시작", photo_viewed: "사진 보기", note_saved: "메모 저장",
  memory_opened: "보관 사진 열기", export_generated: "다운로드 요청",
};
function time(value: string | null) {
  return value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }) : "이력 없음";
}
export function AccountList({ days }: { days: number }) {
  const [report, setReport] = useState<AccountReport | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("계정 목록을 불러오는 중이에요.");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    requestApi(`/api/admin/accounts?days=${days}&page=${page}`).then(data => {
      if (active) { setReport(accountReportSchema.parse(data)); setMessage(""); }
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "다시 시도해주세요."); });
    return () => { active = false; };
  }, [days, page, retry]);
  const accounts = report?.accounts.filter(account => (account.email ?? "").toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const navigate = (next: number) => { setReport(null); setMessage("계정 목록을 불러오는 중이에요."); setSearch(""); setPage(next); };
  return <section aria-labelledby="account-list-title" className="analytics-accounts">
    <h2 id="account-list-title">계정별 사용 내역</h2>
    <p>관리자도 포함한 가입 계정 목록이에요. 최근 로그인은 인증 시스템의 마지막 로그인 시각이며, 모든 재접속을 뜻하지는 않아요.</p>
    <p>사진·보관 수는 현재 상태, 활동 횟수는 위에서 선택한 기간의 수집 기록이에요. 시간은 한국 시간입니다.</p>
    {message && <p role="status">{message}</p>}
    {!report && message !== "계정 목록을 불러오는 중이에요." && <button className="ghost" onClick={() => { setMessage("계정 목록을 불러오는 중이에요."); setRetry(value => value + 1); }}>다시 불러오기</button>}
    {report && <>
      <p>전체 {report.total}개 계정 · {report.page}페이지 · 조회 {time(report.until)}</p>
      <label htmlFor="account-search">이 페이지에서 이메일 찾기</label>
      <input id="account-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="이메일을 입력하세요" />
      {accounts.length === 0 && <p>표시할 계정이 없어요.</p>}
      <ul className="analytics-account-list">
        {accounts.map(account => <li key={account.id} className="analytics-account-card">
          <h3>{account.email ?? "이메일 없는 계정"} {account.administrator && <span className="analytics-admin-badge">관리자</span>}</h3>
          <dl className="analytics-account-meta">
            <div><dt>가입</dt><dd>{time(account.created_at)}</dd></div>
            <div><dt>최근 로그인</dt><dd>{time(account.last_sign_in_at)}</dd></div>
            <div><dt>사진 / 보관</dt><dd>{account.photos}장 / {account.preserved}장</dd></div>
            <div><dt>분석 동의</dt><dd>{account.analytics_consent ? "동의" : account.analytics_consent === false ? "미동의" : "설정 없음"}</dd></div>
            <div><dt>계정 상태</dt><dd>{account.account_state === "active" ? "이용 중" : account.account_state === "deleting" ? "삭제 진행 중" : account.account_state ?? "이용 프로필 없음"}</dd></div>
          </dl>
          <details>
            <summary>사용 내역 보기</summary>
            <p>현재 첫 메모를 남긴 사진 {account.first_notes}장 · 두 번째 메모를 남긴 사진 {account.second_notes}장</p>
            {account.actions === null ? <p>분석 동의가 없어 계정별 상세 활동 기록을 표시하지 않아요.</p>
              : account.actions.length === 0 ? <p>선택한 기간에 수집된 활동 기록이 없어요.</p>
              : <ul className="analytics-account-actions">{account.actions.map(action => <li key={action.name}>
                <strong>{actionNames[action.name] ?? action.name}: {action.count}회</strong><br />최근 {time(action.last_at)}
              </li>)}</ul>}
          </details>
        </li>)}
      </ul>
      <div className="analytics-account-pagination">
        <button className="ghost" disabled={page === 1} onClick={() => navigate(page - 1)}>이전 계정</button>
        <button className="ghost" disabled={report.next_page === null} onClick={() => navigate(report.next_page!)}>다음 계정</button>
      </div>
      <p>수집되지 않은 과거 활동은 복구할 수 없어요. 메모 저장에는 첫·두 번째 메모와 수정이 포함되며, 다운로드 요청은 실제 파일 저장 완료 횟수와 다릅니다. 사진과 메모의 내용은 이 목록에서 조회하지 않아요.</p>
    </>}
  </section>;
}
