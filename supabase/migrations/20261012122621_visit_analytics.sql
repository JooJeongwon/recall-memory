-- 유입은 짧은 탭 세션으로 집계하고, 계정 식별은 분석 동의가 있을 때만 연결합니다.
create table public.visit_events (
  id uuid primary key,
  session_id uuid not null,
  source text not null check (source in ('qr','direct','referral','unknown')),
  page text not null check (page in ('home','login','start','revisit','photo','edit','memories','settings','deletion')),
  actor text not null check (actor in ('visitor','account','participant')),
  user_id uuid references public.profiles(user_id) on delete cascade,
  occurred_at timestamptz not null default clock_timestamp()
);
create index visit_events_time on public.visit_events(occurred_at);
create index visit_events_user on public.visit_events(user_id) where user_id is not null;
alter table public.visit_events enable row level security;
revoke all on public.visit_events from public,anon,authenticated;
grant select,insert,delete on public.visit_events to service_role;

create function public.record_visit(p_event_id uuid,p_session_id uuid,p_source text,p_page text,p_user_id uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare prof public.profiles; kind text := 'visitor'; identified uuid := null;
begin
  if p_user_id is not null then
    select * into prof from public.profiles where user_id = p_user_id for share;
    if not found or prof.account_state <> 'active' then raise exception 'ACCOUNT_DELETING'; end if;
    if exists(select 1 from auth.users where id = p_user_id and lower(email) in ('jwjoo0512@gmail.com','elice0105412@gmail.com')) then return; end if;
    kind := case when exists(select 1 from public.trials where user_id = p_user_id and started_at is not null) then 'participant' else 'account' end;
    if prof.analytics_consent then identified := p_user_id; end if;
  end if;
  insert into public.visit_events(id,session_id,source,page,actor,user_id)
    values(p_event_id,p_session_id,p_source,p_page,kind,identified) on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_visit(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.record_visit(uuid,uuid,text,text,uuid) to service_role;

create function public.remove_identified_visits() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.visit_events where user_id = new.user_id;
  return new;
end;
$$;
revoke all on function public.remove_identified_visits() from public,anon,authenticated;
grant execute on function public.remove_identified_visits() to service_role;
create trigger visit_consent_withdrawal after update of analytics_consent,account_state on public.profiles
  for each row when ((old.analytics_consent and not new.analytics_consent) or new.account_state = 'deleting')
  execute function public.remove_identified_visits();

create function public.analytics_report(p_admin_id uuid,p_days integer default 7) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare since_at timestamptz; report jsonb;
begin
  if p_days is null or p_days not between 1 and 30 then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from auth.users u join public.profiles p on p.user_id = u.id
    where u.id = p_admin_id and u.email_confirmed_at is not null and p.account_state = 'active'
      and lower(u.email) in ('jwjoo0512@gmail.com','elice0105412@gmail.com')) then raise exception 'FORBIDDEN'; end if;
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
    from public.profiles p join auth.users u on u.id=p.user_id left join public.trials t on t.user_id=p.user_id
    where p.account_state='active' and lower(u.email) not in ('jwjoo0512@gmail.com','elice0105412@gmail.com')
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
