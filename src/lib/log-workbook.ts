import ExcelJS from "exceljs";
import type { AccountReport } from "./analytics";
export type LogData = {
 accounts: AccountReport["accounts"];
 since: string; until: string;
 events: {user_id: string; name: string; occurred_at: string}[];
 visits: {actor: string; source: string; page: string; occurred_at: string; session_id: string}[];
};
export async function createLogWorkbook(data: LogData) {
 const {accounts, events, visits} = data;  const workbook = new ExcelJS.Workbook();
  workbook.creator = "기억할 권리";
  const kst = (value: string | null) => value ? new Date(Date.parse(value) + 9 * 3_600_000) : null;
  function sheet(name: string, headers: string[], rows: (string | number | Date | null)[][], dateColumns: number[] = []) {
    const ws = workbook.addWorksheet(name, {views: [{state: "frozen", ySplit: 1, showGridLines: false}]});
    ws.addRow(headers); ws.addRows(rows);
    ws.columns.forEach((column, i) => { column.width = i === 0 ? 36 : dateColumns.includes(i + 1) ? 23 : 20; });
    ws.getRow(1).eachCell(cell => {
      cell.fill = {type: "pattern", pattern: "solid", fgColor: {argb: "FF334155"}};
      cell.font = {name: "Arial", size: 11, bold: true, color: {argb: "FFFFFFFF"}};
    });
    ws.getRow(1).height = 25;
    for (const col of dateColumns) ws.getColumn(col).numFmt = "yyyy-mm-dd hh:mm:ss";
    ws.autoFilter = {from: {row: 1, column: 1}, to: {row: ws.rowCount, column: headers.length}};
    return ws;
  }
  sheet("요약", ["항목", "값"], [
    ["조회 시작 (한국 시간)", kst(data.since)], ["조회 종료 (한국 시간)", kst(data.until)],
    ["계정 수 (관리자 포함)", accounts.length], ["현재 보관 사진 수", accounts.reduce((n,a)=>n+a.preserved,0)],
    ["동의한 사용자 활동 기록 수", events.length], ["방문 기록 수", visits.length],
    ["방문 세션 수", new Set(visits.map(v=>v.session_id)).size],
    ["QR 방문 세션 수", new Set(visits.filter(v=>v.source === "qr").map(v=>v.session_id)).size],
    ["출처", "기존 Supabase Auth · profiles · photos · events · visit_events"],
    ["로그인 시각", "마지막 인증 시각이며 전체 로그인 이력은 아닙니다."],
    ["활동 기록", "현재 분석에 동의한 계정만 포함하며 관리자 활동도 포함합니다."],
    ["방문 기록", "계정과 연결하지 않은 세션입니다. 수집 전 기록은 복구할 수 없습니다."],
    ["ZIP 생성", "파일 생성 요청 기록이며 다운로드 완료를 뜻하지 않습니다."],
    ["보관 기간", "방문 원본은 최근 90일만 보관합니다."],
  ]);
  const summary = workbook.getWorksheet("요약")!;
  summary.getColumn(2).width = 75;
  summary.getCell("B2").numFmt = summary.getCell("B3").numFmt = "yyyy-mm-dd hh:mm:ss";
  sheet("계정별 현황", ["이메일", "관리자", "가입 시각 (한국)", "마지막 로그인 (한국)", "분석 동의", "계정 상태", "사진 수", "보관 수", "첫 메모 사진 수", "두 번째 메모 사진 수"], accounts.map(a=>[
    a.email, a.administrator ? "예" : "아니오", kst(a.created_at), kst(a.last_sign_in_at),
    a.analytics_consent === null ? "미설정" : a.analytics_consent ? "동의" : "미동의", a.account_state,
    a.photos, a.preserved, a.first_notes, a.second_notes,
  ]), [3,4]);
  const labels: Record<string,string> = {trial_started:"사진 사용 시작",photo_viewed:"사진 다시 보기",note_saved:"메모 저장",memory_opened:"보관 사진 열기",export_generated:"ZIP 생성 요청"};
  sheet("활동 기록", ["이메일", "행동", "시각 (한국)"], events.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)).map(e=>[
    accounts.find(a=>a.id===e.user_id)?.email ?? "이메일 없음", labels[e.name] ?? e.name, kst(e.occurred_at),
  ]), [3]);
  sheet("방문 기록", ["세션 ID", "유입 경로", "화면", "방문 유형", "시각 (한국)"], visits.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)).map(v=>[
    v.session_id, v.source, v.page, v.actor, kst(v.occurred_at),
  ]), [5]);
  return {bytes: await workbook.xlsx.writeBuffer(), date: new Date(Date.parse(data.until) + 9 * 3_600_000).toISOString().slice(0,10)};
}

