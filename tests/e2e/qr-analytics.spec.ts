import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {analyticsReportSchema} from '../../src/lib/analytics';

const admin=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVER_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const browserAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

test('QR 출처 저장·중복 방지·추적 거부·관리자 권한·통계 계약',async({page,baseURL})=>{
 const db=admin();
 const session=crypto.randomUUID();
 const headers={Origin:baseURL!,'User-Agent':browserAgent};
 const visit={event_id:crypto.randomUUID(),session_id:session,source:'qr',page:'home'};
 let userId:string|undefined;
 try {
  const qr=await page.request.get('/qr',{maxRedirects:0});
  expect(qr.status()).toBe(302);
  expect(qr.headers().location).toBe(baseURL+'/?source=qr');
  const endpoint='/api/analytics/visit';
  expect((await page.request.post(endpoint,{headers,data:visit})).status()).toBe(204);
  expect((await page.request.post(endpoint,{headers,data:visit})).status()).toBe(204);
  const stored=await db.from('visit_events').select('*').eq('session_id',session);
  expect(stored.error).toBeNull();
  expect(stored.data).toHaveLength(1);
  expect(stored.data![0]).toMatchObject({id:visit.event_id,source:'qr',page:'home',actor:'visitor',user_id:null});
  const excludedHeaders:Record<string,string>[]=[{DNT:'1'},{'sec-gpc':'1'},{'User-Agent':'HeadlessChrome'}];
  for(const extra of excludedHeaders)
   expect((await page.request.post(endpoint,{headers:{...headers,...extra},data:{...visit,event_id:crypto.randomUUID()}})).status()).toBe(204);
  expect((await page.request.post(endpoint,{headers:{...headers,Origin:'https://invalid.example'},data:visit})).status()).toBe(403);
  expect((await page.request.post(endpoint,{headers,data:{...visit,email:'private@example.test'}})).status()).toBe(400);
  expect((await db.from('visit_events').select('*',{count:'exact',head:true}).eq('session_id',session)).count).toBe(1);
  expect((await page.request.get('/api/admin/analytics')).status()).toBe(401);
  await page.goto('/admin/analytics');
  await expect(page).toHaveURL(/\/login$/);
  const created=await db.auth.admin.createUser({email:`qr-qa-${crypto.randomUUID()}@example.test`,password:'Aa1!'+crypto.randomUUID(),email_confirm:true});
  expect(created.error).toBeNull();
  userId=created.data.user!.id;
  // 합성 계정은 관리자 명단에 추가하지 않고 실제 세션으로 비관리자 거절을 검증합니다.
  const link=await db.auth.admin.generateLink({type:'magiclink',email:created.data.user!.email!});
  expect(link.error).toBeNull();
  const cookies=new Map<string,string>();
  const server=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
   cookies:{getAll:()=>[],setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))},
  });
  expect((await server.auth.verifyOtp({token_hash:link.data.properties!.hashed_token,type:'magiclink'})).error).toBeNull();
  await page.context().addCookies([...cookies].map(([name,value])=>({name,value,url:baseURL!})));
  const me=await page.request.get('/api/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).can_view_analytics).toBe(false);
  expect((await page.request.get('/api/admin/analytics')).status()).toBe(403);
  await page.goto('/admin/analytics');
  await expect(page.getByText('통계 접근 권한이 없어요.')).toBeVisible();
  const administrators=await db.from('analytics_administrators').select('user_id').limit(1);
  expect(administrators.error).toBeNull();
  const report=await db.rpc('analytics_report',{p_admin_id:administrators.data![0].user_id,p_days:7});
  expect(report.error).toBeNull();
  const parsed=analyticsReportSchema.parse(report.data);
  expect(parsed.sources.some(s=>s.source==='qr'&&s.sessions>=1)).toBe(true);
  const denied=await db.rpc('analytics_report',{p_admin_id:userId,p_days:7});
  expect(denied.error?.message).toBe('FORBIDDEN');
 } finally {
  expect((await db.from('visit_events').delete().eq('session_id',session)).error).toBeNull();
  if(userId){
   expect((await db.from('profiles').delete().eq('user_id',userId)).error).toBeNull();
   expect((await db.auth.admin.deleteUser(userId)).error).toBeNull();
  }
 }
});

test('운영 QR 브라우저 방문은 로그인 이동에도 같은 QR 세션으로 저장된다',async({page,baseURL})=>{
 test.skip(new URL(baseURL!).hostname==='localhost','로컬 방문은 기존 정책에 따라 수집하지 않습니다.');
 const db=admin(),sessionId=crypto.randomUUID();
 const eventIds:string[]=[];
 await page.addInitScript(({sessionId})=>{
  Object.defineProperty(navigator,'webdriver',{get:()=>false});
  sessionStorage.setItem('recall-visit',JSON.stringify({id:sessionId,source:'qr',last:Date.now()}));
 },{sessionId});
 page.on('request',r=>{
  if(new URL(r.url()).pathname==='/api/analytics/visit') eventIds.push(r.postDataJSON().event_id);
 });
 try {
  const home=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/analytics/visit'&&r.request().postDataJSON().page==='home');
  await page.goto('/qr');
  expect((await home).status()).toBe(204);
  const login=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/analytics/visit'&&r.request().postDataJSON().page==='login');
  await page.goto('/login');
  expect((await login).status()).toBe(204);
  const rows=await db.from('visit_events').select('source,page,session_id').in('id',eventIds);
  expect(rows.error).toBeNull();
  expect(rows.data).toHaveLength(2);
  expect(rows.data!.every(r=>r.source==='qr'&&r.session_id===sessionId)).toBe(true);
 } finally {
  if(eventIds.length) expect((await db.from('visit_events').delete().in('id',eventIds)).error).toBeNull();
 }
});
