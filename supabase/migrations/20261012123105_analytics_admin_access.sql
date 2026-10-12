-- 인증된 관리자 명단만 저장합니다. 서버 역할에 auth.users 조회 권한을 추가하지 않습니다.
create table public.analytics_administrators (
  user_id uuid primary key references public.profiles(user_id) on delete cascade
);
alter table public.analytics_administrators enable row level security;
revoke all on public.analytics_administrators from public,anon,authenticated;
grant select on public.analytics_administrators to service_role;
insert into public.analytics_administrators(user_id)
  select u.id from auth.users u join public.profiles p on p.user_id=u.id
  where u.email_confirmed_at is not null and p.account_state='active'
    and lower(u.email) in ('jwjoo0512@gmail.com','elice0105412@gmail.com');

create or replace function public.record_visit(p_event_id uuid,p_session_id uuid,p_source text,p_page text,p_user_id uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare prof public.profiles; kind text := 'visitor'; identified uuid := null;
begin
  if p_user_id is not null then
    select * into prof from public.profiles where user_id = p_user_id for share;
    if not found or prof.account_state <> 'active' then raise exception 'ACCOUNT_DELETING'; end if;
    if exists(select 1 from public.analytics_administrators where user_id = p_user_id) then return; end if;
    kind := case when exists(select 1 from public.trials where user_id = p_user_id and started_at is not null) then 'participant' else 'account' end;
    if prof.analytics_consent then identified := p_user_id; end if;
  end if;
  insert into public.visit_events(id,session_id,source,page,actor,user_id)
    values(p_event_id,p_session_id,p_source,p_page,kind,identified) on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_visit(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.record_visit(uuid,uuid,text,text,uuid) to service_role;

create or replace function public.analytics_report(p_admin_id uuid,p_days integer default 7) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare since_at timestamptz; report jsonb;
begin
  if p_days is null or p_days not between 1 and 30 then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from public.analytics_administrators a join public.profiles p on p.user_id = a.user_id
    where a.user_id = p_admin_id and p.account_state = 'active') then raise exception 'FORBIDDEN'; end if;
  since_at := date_trunc('day',clock_timestamp() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' - make_interval(days => p_days - 1);
  with recent as (select * from public.visit_events where occurred_at >= since_at),
  sessions as (
    select session_id,(array_agg(source order by occurred_at,id))[1] as source,
      max(case actor when 'participant' then 2 when 'account' then 1 else 0 end) as rank
    from recent group by session_id
  ),
  sources as (
    select source,count(*) as sessions,count(*) filter(where rank=0) as visitor_sessions,
      count(*) filter(where rank>=1) as account_sessions,count(*) filter(where rank=2) as participant_sessions
    from sessions group by source
  ),
  daily as (
    select (occurred_at at time zone 'Asia/Seoul')::date as day,count(*) as pageviews,
      count(distinct session_id) as sessions,count(distinct user_id) as consenting_accounts
    from recent group by 1
  ),
  accounts as (
    select p.user_id,p.analytics_consent,t.started_at
    from public.profiles p left join public.trials t on t.user_id=p.user_id
    where p.account_state='active' and not exists(select 1 from public.analytics_administrators a where a.user_id=p.user_id)
  ),
  actions as (select e.name,count(*) as events,count(distinct e.user_id) as accounts from public.events e
    join accounts a on a.user_id=e.user_id and a.analytics_consent where e.occurred_at>=since_at group by e.name)
  select jsonb_build_object(
    'since',since_at,'until',clock_timestamp(),'days',p_days,
    'pageviews',(select count(*) from recent),
    'sessions',(select count(*) from sessions),
    'visitor_sessions',(select count(*) from sessions where rank=0),
    'account_sessions',(select count(*) from sessions where rank>=1),
    'participant_sessions',(select count(*) from sessions where rank=2),
    'consenting_active_accounts',(select count(distinct user_id) from recent),
    'registered_accounts',(select count(*) from accounts),
    'participating_accounts',(select count(*) from accounts where started_at is not null),
    'consented_accounts',(select count(*) from accounts where analytics_consent),
    'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.source) from sources s),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from daily d),'[]'::jsonb),
    'actions',coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from actions a),'[]'::jsonb)
  ) into report;
  return report;
end;
$$;
revoke all on function public.analytics_report(uuid,integer) from public,anon,authenticated;
grant execute on function public.analytics_report(uuid,integer) to service_role;
