import {afterEach,expect,it,vi} from "vitest";
import {accountUsageReport} from "../../src/lib/server/account-usage";

const mocks=vi.hoisted(()=>({authorize:vi.fn(),client:vi.fn(),list:vi.fn(),member:true,selects:[] as string[]}));
vi.mock("server-only",()=>({}));
vi.mock("../../src/lib/server/analytics",()=>({requireAnalyticsAdmin:mocks.authorize}));
vi.mock("../../src/lib/server/admin",()=>({adminClient:mocks.client}));
const first="00000000-0000-4000-8000-000000000001",second="00000000-0000-4000-8000-000000000002";
type Row=Record<string,unknown>;
class Query {
  ids:string[]=[];offset=0;single=false;
  constructor(public table:string){}
  select(columns:string){mocks.selects.push(`${this.table}:${columns}`);return this;}
  eq(){return this;} in(_field:string,ids:string[]){this.ids=ids;return this;}
  gte(){return this;} lte(){return this;} order(){return this;}
  range(offset:number){this.offset=offset;return this;}
  maybeSingle(){this.single=true;return this;}
  then(resolve:(value:{data:Row[]|Row|null;error:null})=>unknown){
    let data:Row[]|Row|null=[];
    if(this.table==="analytics_administrators") data=this.single ? mocks.member?{user_id:first}:null : [{user_id:first}];
    if(this.table==="profiles") data=[{user_id:first,analytics_consent:true,account_state:"active"},{user_id:second,analytics_consent:false,account_state:"active"}];
    if(this.table==="photos") data=[{user_id:first,preserved_at:"2026-10-13",first_note_at:"2026-10-13",second_note_at:"2026-10-13"},{user_id:second,preserved_at:null,first_note_at:null,second_note_at:null}];
    if(this.table==="events") {
      expect(this.ids).toEqual([first]);
      data=Array.from({length:this.offset===0?1000:1},()=>({user_id:first,name:"note_saved",occurred_at:"2026-10-13T00:00:00Z"}));
    }
    return Promise.resolve(resolve({data,error:null}));
  }
}
function setup(){
  mocks.authorize.mockResolvedValue({user:{id:first}});
  mocks.client.mockReturnValue({from:(table:string)=>new Query(table),auth:{admin:{listUsers:mocks.list}}});
  mocks.list.mockResolvedValue({data:{total:2,users:[
    {id:first,email:"admin@example.test",created_at:"2026-10-10T00:00:00Z",last_sign_in_at:"2026-10-13T00:00:00Z",user_metadata:{private:"never-return"}},
    {id:second,email:"user@example.test",created_at:"2026-10-10T00:00:00Z"},
  ]},error:null});
}
afterEach(()=>{vi.resetAllMocks();mocks.member=true;mocks.selects.length=0;});
it("미인증·비관리자는 계정 목록을 조회하지 못한다",async()=>{
  mocks.authorize.mockRejectedValue({status:401});
  await expect(accountUsageReport(7,1,20)).rejects.toMatchObject({status:401});
  expect(mocks.client).not.toHaveBeenCalled();
  mocks.authorize.mockRejectedValue({status:403});
  await expect(accountUsageReport(7,1,20)).rejects.toMatchObject({status:403});
  expect(mocks.client).not.toHaveBeenCalled();
});
it("기존 DB 관리자 명단에서 제외되면 Auth 계정 조회 전에 거절한다",async()=>{
  setup();mocks.member=false;
  await expect(accountUsageReport(7,1,20)).rejects.toMatchObject({status:403});
  expect(mocks.list).not.toHaveBeenCalled();
});
it("동의한 계정만 활동을 읽고 1000건을 넘는 기록도 집계하며 원문·Auth 메타데이터를 반환하지 않는다",async()=>{
  setup();const result=await accountUsageReport(7,1,20);
  expect(result.accounts[0]).toMatchObject({photos:1,preserved:1,first_notes:1,second_notes:1,actions:[{name:"note_saved",count:1001}]});
  expect(result.accounts[1]).toMatchObject({photos:1,preserved:0,last_sign_in_at:null,actions:null});
  expect(JSON.stringify(result)).not.toContain("never-return");
  expect(mocks.selects).toContain("photos:user_id,preserved_at,first_note_at,second_note_at");
  expect(mocks.selects).toContain("events:user_id,name,occurred_at");
  expect(mocks.list).toHaveBeenCalledWith({page:1,perPage:20});
  expect(result.next_page).toBeNull();
});
it("빈 페이지에서도 전체 계정 수를 임의로 늘리지 않는다",async()=>{
  setup();mocks.list.mockResolvedValue({data:{total:2,users:[]},error:null});
  const report=await accountUsageReport(7,2,20);
  expect(report).toMatchObject({accounts:[],total:2,next_page:null});
});
