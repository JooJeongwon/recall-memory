"use client";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
import { analyticsReportSchema, type AnalyticsReport } from "@/lib/analytics";
import { AccountList } from "./account-list";

const sources = { qr: "QR 표시 링크", direct: "직접/출처 없음", referral: "외부 링크", unknown: "출처 불명" };
const actionNames: Record<string, string> = { trial_started: "사진 사용 시작", photo_viewed: "사진 다시 보기", note_saved: "메모 저장", memory_opened: "보관 사진 열기", export_generated: "ZIP 생성" };
export function AnalyticsDashboard() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [message, setMessage] = useState("통계를 불러오는 중이에요.");
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  async function downloadLogs() {
    setExporting(true); setExportMessage("엑셀 파일을 만들고 있어요.");
    try {
      const response = await fetch(`/api/admin/logs/export?days=${days}`, {cache: "no-store"});
      if (!response.ok) {
        const failure = await response.json();
        throw new Error(failure.error?.message ?? "다운로드를 다시 시도해주세요.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url;
      link.download = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "recall-logs.xlsx";
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportMessage("엑셀 파일을 다운로드했어요.");
    } catch (error) { setExportMessage(error instanceof Error ? error.message : "다시 시도해주세요."); }
    finally { setExporting(false); }
  }
  useEffect(() => {
    let active = true;
    requestApi(`/api/admin/analytics?days=${days}`).then((data) => {
      if (active) { setReport(analyticsReportSchema.parse(data)); setMessage(""); }
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "다시 시도해주세요."); });
    return () => { active = false; };
  }, [days, retry]);
  const start = report ? new Date(report.since).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "";
  return <section className="analytics-dashboard">
    <h1>방문·사용자 통계</h1>
    <label htmlFor="analytics-days">집계 기간 (한국 시간)</label>
    <select id="analytics-days" value={days} onChange={(event) => { setReport(null); setMessage("통계를 불러오는 중이에요."); setDays(Number(event.target.value)); }}>
      <option value={1}>오늘</option><option value={7}>최근 7일</option><option value={30}>최근 30일</option><option value={90}>최근 90일</option>
    </select>
    <button className="ghost" onClick={() => setRetry((value) => value + 1)}>새로고침</button>
    <button className="ghost" disabled={exporting} onClick={downloadLogs}>엑셀 로그 다운로드</button>
    <p>선택한 기간의 활동·방문 기록과 전체 계정 현황을 내려받아요. 현재 남아 있는 방문 기록 전체는 최근 90일을 선택해주세요.</p>
    <p role="status">{exportMessage}</p>
    <p role="status">{message}</p>
    {report && <>
      <p>{start}부터 조회 시점까지 · 관리자 계정의 로그인 방문 제외</p>
      <dl className="analytics-summary">
        {[
          ["방문 세션", report.sessions], ["둘러보기 세션", report.visitor_sessions],
          ["로그인 방문 세션", report.account_sessions], ["사진 사용 이력이 있는 방문 세션", report.participant_sessions],
          ["화면 조회", report.pageviews], ["동의한 로그인 고유 계정", report.consenting_active_accounts],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString("ko-KR")}</dd></div>)}
      </dl>
      <p>방문 세션은 같은 탭에서 30분 이내 이어진 방문이에요. 둘러보기는 로그인 없이 끝난 세션, 로그인 방문에는 사진 사용자 방문도 포함돼요. 서로 다른 기기·탭의 같은 사람은 별도 세션입니다.</p>
      <h2>유입 경로</h2>
      <div className="analytics-table"><table><caption>기간 중 활동한 방문 세션</caption>
        <thead><tr><th scope="col">경로</th><th scope="col">전체</th><th scope="col">둘러보기</th><th scope="col">로그인</th><th scope="col">사진 사용자</th></tr></thead>
        <tbody>{report.sources.map((row) => <tr key={row.source}><th scope="row">{sources[row.source]}</th><td>{row.sessions}</td><td>{row.visitor_sessions}</td><td>{row.account_sessions}</td><td>{row.participant_sessions}</td></tr>)}</tbody>
      </table></div>
      <p>QR 표시 링크는 <a href="/qr" target="_blank" rel="noreferrer">/qr</a>입니다. QR을 스캔한 횟수가 아니라 이 링크로 들어온 세션을 셉니다. 같은 일반 주소를 담은 기존 QR은 직접 방문과 구분할 수 없어요.</p>
      <h2>일별 방문</h2>
      <div className="analytics-table"><table><thead><tr><th scope="col">날짜</th><th scope="col">세션</th><th scope="col">화면 조회</th><th scope="col">동의한 고유 계정</th></tr></thead>
        <tbody>{report.daily.map((row) => <tr key={row.day}><th scope="row">{row.day}</th><td>{row.sessions}</td><td>{row.pageviews}</td><td>{row.consenting_accounts}</td></tr>)}</tbody>
      </table></div>
      <p>여러 날 방문한 계정·세션은 각 날짜에 포함되므로 일별 합계와 기간의 고유 수는 달라질 수 있어요.</p>
      <h2>현재 계정 현황</h2>
      <p>가입 계정 {report.registered_accounts} · 사진 사용 시작 계정 {report.participating_accounts} · 분석 동의 계정 {report.consented_accounts}</p>
      <p>이 수치는 방문 기간과 별개인 현재 DB의 계정 수예요. 계정 삭제에 따라 줄어들 수 있어요.</p>
      <AccountList key={`${days}-${retry}`} days={days} />
      <h2>동의한 사용자의 행동</h2>
      <div className="analytics-table"><table><thead><tr><th scope="col">행동</th><th scope="col">기록 수</th><th scope="col">고유 계정</th></tr></thead>
        <tbody>{report.actions.map((row) => <tr key={row.name}><th scope="row">{actionNames[row.name] ?? row.name}</th><td>{row.events}</td><td>{row.accounts}</td></tr>)}</tbody>
      </table></div>
      <p>동의하지 않은 사용자는 이 행동 표와 로그인 고유 계정 수에서 제외합니다. 메모 저장은 첫·두 번째 저장과 수정을 포함하고, ZIP 생성은 실제 파일 저장 완료를 뜻하지 않아요.</p>
      <button className="ghost" onClick={() => {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const link = document.createElement("a");
        link.href = url; link.download = `analytics-${new Date().toISOString().slice(0,10)}.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }}>집계 데이터 다운로드</button>
    </>}
    <aside className="notice">방문 원본은 90일을 넘기면 매일 정리해요. 수집 시작 전 방문은 복구할 수 없어요. 스크립트 차단·통신 실패·추적 거부 설정으로 빠진 방문이 있을 수 있고, 자동 방문을 완벽히 제거할 수는 없어요. 실제 사람 수와 방문 세션 수는 다릅니다.</aside>
  </section>;
}
