import {expect,it} from "vitest";
import ExcelJS from "exceljs";
import {createLogWorkbook} from "../../src/lib/log-workbook";

it("엑셀에 한국 시간·숫자·빈 로그인 시각을 보존하고 수식으로 해석하지 않는다", async()=>{
 const file=await createLogWorkbook({since:"2026-10-12T15:00:00Z",until:"2026-10-13T00:00:00Z",
 accounts:[{id:"one",email:"=HYPERLINK(secret)",administrator:false,created_at:"2026-10-12T15:00:00Z",
 last_sign_in_at:null,analytics_consent:false,account_state:"active",photos:3,preserved:2,first_notes:2,second_notes:2,actions:null}],
 events:[],visits:[{actor:"visitor",source:"qr",page:"home",occurred_at:"2026-10-13T00:00:00Z",session_id:"session"}]});
 const wb=new ExcelJS.Workbook(); await wb.xlsx.load(file.bytes);
 expect(wb.worksheets.map(s=>s.name)).toEqual(["요약","계정별 현황","활동 기록","방문 기록"]);
 const row=wb.getWorksheet("계정별 현황")!.getRow(2);
 expect(row.getCell(1).value).toBe("=HYPERLINK(secret)");
 expect(row.getCell(1).type).toBe(ExcelJS.ValueType.String);
 expect(row.getCell(3).value).toEqual(new Date("2026-10-13T00:00:00Z"));
 expect(row.getCell(4).value).toBeNull(); expect(row.getCell(7).value).toBe(3);
 expect(wb.getWorksheet("활동 기록")!.rowCount).toBe(1);
 expect(wb.getWorksheet("요약")!.getCell("B9").value).toBe(1);
});
