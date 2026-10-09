-- db:prepare로 Supabase CLI가 생성한 최초 migration에 복사합니다.
-- 확정된 정상 사진은 만료를 이유로 삭제하지 않습니다.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  timezone text not null default 'Asia/Seoul',
  account_state text not null default 'active' check (account_state in ('active','deleting')),
  analytics_consent boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete restrict,
  duration_hours integer not null default 48 check (duration_hours > 0),
  started_at timestamptz, ends_at timestamptz,
  experiment_version text not null default 'mvp-1',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check ((started_at is null and ends_at is null) or
    (started_at is not null and ends_at is not null and ends_at > started_at))
);
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  trial_id uuid not null,
  client_request_id uuid not null,
  lifecycle text not null default 'uploading' check (lifecycle in ('uploading','ready','failed','deleting','deleted')),
  original_key text not null unique,
  thumbnail_key text unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  width integer, height integer,
  note_text text not null default '' check (char_length(note_text) <= 500),
  preserved_at timestamptz, first_note_at timestamptz, first_viewed_at timestamptz,
  version integer not null default 1 check (version > 0),
  upload_deadline_at timestamptz not null default (now() + interval '24 hours'),
  validation_token uuid, validation_until timestamptz,
  ready_at timestamptz, delete_requested_at timestamptz, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, client_request_id), unique (id, user_id),
  foreign key (trial_id, user_id) references public.trials(id, user_id) on delete restrict,
  check ((preserved_at is null and first_note_at is null and note_text = '') or
    (preserved_at is not null and first_note_at is not null)),
  check (lifecycle <> 'ready' or (ready_at is not null and thumbnail_key is not null and
    width is not null and height is not null and width > 0 and height > 0 and width::bigint * height::bigint <= 40000000))
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  trial_id uuid, photo_id uuid,
  name text not null check (name in ('trial_started','photo_viewed','note_saved','memory_opened','export_generated')),
  occurred_at timestamptz not null default now(), client_event_id uuid not null,
  visit_context text not null default 'unknown' check (visit_context in ('organic','prompted','unknown')),
  unique (user_id, client_event_id),
  foreign key (trial_id, user_id) references public.trials(id, user_id) on delete cascade,
  foreign key (photo_id, user_id) references public.photos(id, user_id) on delete cascade
);
create table public.cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  photo_id uuid references public.photos(id) on delete set null,
  kind text not null check (kind in ('photo_delete','account_delete','incomplete_upload')),
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending','running','retry','done','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  run_after timestamptz not null default now(), locked_until timestamptz,
  lease_token uuid,
  created_at timestamptz not null default now(), finished_at timestamptz,
  error_code text,
  progress_token_hash text unique,
  progress_expires_at timestamptz
);
create index photos_revisit on public.photos(user_id, lifecycle, ready_at, id);
create index photos_memories on public.photos(user_id, preserved_at desc, id) where preserved_at is not null and lifecycle = 'ready';
create index photos_trial on public.photos(trial_id, user_id);
create index photos_incomplete on public.photos(upload_deadline_at) where lifecycle in ('uploading','failed');
create index events_user on public.events(user_id, occurred_at);
create index events_trial on public.events(trial_id, user_id);
create index events_photo on public.events(photo_id, user_id);
create index cleanup_due on public.cleanup_jobs(status, run_after);
create index cleanup_user on public.cleanup_jobs(user_id);
create index cleanup_photo on public.cleanup_jobs(photo_id);

alter table public.profiles enable row level security;
alter table public.trials enable row level security;
alter table public.photos enable row level security;
alter table public.events enable row level security;
alter table public.cleanup_jobs enable row level security;
revoke all on public.profiles, public.trials, public.photos, public.events, public.cleanup_jobs from public, anon, authenticated;
grant select on public.profiles, public.trials, public.photos to authenticated;
grant all on public.profiles, public.trials, public.photos, public.events, public.cleanup_jobs to service_role;
create policy profile_owner on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy trial_owner on public.trials for select to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.user_id = trials.user_id and p.account_state = 'active')
);
create policy photo_owner on public.photos for select to authenticated using (
  user_id = (select auth.uid()) and lifecycle = 'ready' and
  exists (select 1 from public.profiles p where p.user_id = photos.user_id and p.account_state = 'active')
);
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('memory-assets','memory-assets',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy memory_assets_owner on storage.objects for select to authenticated using (
  bucket_id = 'memory-assets' and exists (select 1 from public.photos p
    where p.user_id = (select auth.uid()) and p.lifecycle = 'ready'
      and (p.original_key = name or p.thumbnail_key = name))
);

create function public.app_policy() returns jsonb language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('trialHours',48,'maxPhotos',20,'maxBatch',10,'maxBytes',10485760,
    'maxPixels',40000000,'noteLength',500,'assetTtl',300,'reservationHours',24,'bucket','memory-assets');
$$;

create function public.ensure_profile(p_user_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.cleanup_jobs where dedupe_key = 'account:' || p_user_id::text and kind = 'account_delete') then
    raise exception 'ACCOUNT_DELETING';
  end if;
  insert into public.profiles(user_id) values (p_user_id) on conflict do nothing;
  perform 1 from public.profiles where user_id = p_user_id and account_state = 'active' for update;
  if not found then raise exception 'ACCOUNT_DELETING'; end if;
end;
$$;

create function public.me_state(p_user_id uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  perform public.ensure_profile(p_user_id);
  select jsonb_build_object('profile',to_jsonb(p),'trial',to_jsonb(t),'server_now',clock_timestamp(),
    'can_upload',t.ends_at is null or t.ends_at > clock_timestamp(),
    'trial_state',case when t.started_at is null then 'not_started' when clock_timestamp() >= t.ends_at then 'ended' else 'active' end)
  into result from public.profiles p left join public.trials t on t.user_id = p.user_id where p.user_id = p_user_id;
  return result;
end;
$$;

create function public.reserve_uploads(p_user_id uuid, p_files jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t public.trials; p public.photos; f jsonb; result jsonb := '[]'; new_id uuid; ext text;
begin
  perform public.ensure_profile(p_user_id); -- 모든 변경: profile → trial → photo 잠금 순서.
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) not between 1 and 10 then raise exception 'INVALID_INPUT'; end if;
  insert into public.trials(user_id) values (p_user_id) on conflict do nothing;
  select * into t from public.trials where user_id = p_user_id for update;
  for f in select value from jsonb_array_elements(p_files) loop
    select * into p from public.photos where user_id = p_user_id and client_request_id = (f->>'client_request_id')::uuid;
    if found then
      if p.original_name <> f->>'original_name' or p.mime_type <> f->>'mime_type' or p.byte_size <> (f->>'byte_size')::bigint then raise exception 'INVALID_INPUT'; end if;
      if p.lifecycle not in ('uploading','ready') then raise exception 'PHOTO_NOT_READY'; end if;
      if p.lifecycle = 'uploading' and (clock_timestamp() >= p.upload_deadline_at or clock_timestamp() >= t.ends_at) then raise exception 'TRIAL_ENDED'; end if;
      result := result || jsonb_build_array(to_jsonb(p)); continue;
    end if;
    if clock_timestamp() >= t.ends_at then raise exception 'TRIAL_ENDED'; end if;
    if (select count(*) from public.photos where user_id = p_user_id and lifecycle <> 'deleted') >= 20 then raise exception 'LIMIT_EXCEEDED'; end if;
    ext := case f->>'mime_type' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
    if ext is null or char_length(f->>'original_name') not between 1 and 255 or (f->>'byte_size')::bigint not between 1 and 10485760 then raise exception 'INVALID_INPUT'; end if;
    new_id := gen_random_uuid();
    insert into public.photos(id,user_id,trial_id,client_request_id,original_key,thumbnail_key,original_name,mime_type,byte_size)
    values (new_id,p_user_id,t.id,(f->>'client_request_id')::uuid,
      p_user_id::text || '/' || new_id::text || '/original.' || ext,
      p_user_id::text || '/' || new_id::text || '/thumbnail.webp',f->>'original_name',f->>'mime_type',(f->>'byte_size')::bigint)
    returning * into p;
    result := result || jsonb_build_array(to_jsonb(p));
  end loop;
  return result;
end;
$$;

create function public.queue_photo_delete(p_user_id uuid, p_photo_id uuid, p_kind text default 'photo_delete') returns public.cleanup_jobs
language plpgsql security invoker set search_path = '' as $$
declare p public.photos; j public.cleanup_jobs;
begin
  perform 1 from public.profiles where user_id = p_user_id for update;
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_kind not in ('photo_delete','incomplete_upload') then raise exception 'INVALID_INPUT'; end if;
  select * into j from public.cleanup_jobs where dedupe_key = 'photo:' || p.id::text;
  if found then return j; end if;
  if p.lifecycle = 'deleted' then return null; end if;
  if p_kind = 'incomplete_upload' and (p.lifecycle not in ('uploading','failed') or p.preserved_at is not null) then raise exception 'PHOTO_NOT_READY'; end if;
  update public.photos set lifecycle = 'deleting', delete_requested_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp() where id = p.id;
  -- 이미 발급한 업로드 토큰(2시간)이 파일을 재생성하지 못하도록 여유를 둡니다.
  insert into public.cleanup_jobs(user_id,photo_id,kind,dedupe_key,run_after)
  values (p_user_id,p.id,p_kind,'photo:' || p.id::text,
    greatest(clock_timestamp(),p.created_at + interval '2 hours 5 minutes',
      case when p.ready_at is null then clock_timestamp() + interval '2 hours 5 minutes' else p.ready_at + interval '2 hours 5 minutes' end,
      coalesce(p.validation_until,clock_timestamp()) + interval '5 minutes')) returning * into j;
  return j;
end;
$$;

create function public.claim_upload(p_user_id uuid,p_photo_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.photos; t public.trials; token uuid;
begin
  perform public.ensure_profile(p_user_id);
  select * into t from public.trials where user_id = p_user_id for update;
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.lifecycle = 'ready' then return jsonb_build_object('photo',to_jsonb(p),'already_ready',true); end if;
  if p.lifecycle <> 'uploading' then raise exception 'PHOTO_NOT_READY'; end if;
  if clock_timestamp() >= t.ends_at or clock_timestamp() >= p.upload_deadline_at then
    perform public.queue_photo_delete(p_user_id,p_photo_id,'incomplete_upload');
    return jsonb_build_object('error','TRIAL_ENDED');
  end if;
  if p.validation_until > clock_timestamp() then raise exception 'PHOTO_NOT_READY'; end if;
  token := gen_random_uuid();
  update public.photos set validation_token = token, validation_until = clock_timestamp() + interval '5 minutes' where id = p.id returning * into p;
  return jsonb_build_object('photo',to_jsonb(p),'token',token,'already_ready',false);
end;
$$;

create function public.release_upload(p_user_id uuid,p_photo_id uuid,p_token uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ensure_profile(p_user_id);
  update public.photos set validation_token = null,validation_until = null
  where id = p_photo_id and user_id = p_user_id and lifecycle = 'uploading' and validation_token = p_token;
end;
$$;

create function public.complete_upload(p_user_id uuid,p_photo_id uuid,p_token uuid,p_width integer,p_height integer,p_bytes bigint,p_mime text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.photos; t public.trials; ts timestamptz;
begin
  perform public.ensure_profile(p_user_id);
  select * into t from public.trials where user_id = p_user_id for update;
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.lifecycle = 'ready' then return to_jsonb(p); end if;
  if p.lifecycle <> 'uploading' or p.validation_token is distinct from p_token or p.validation_until <= clock_timestamp() then raise exception 'PHOTO_NOT_READY'; end if;
  ts := clock_timestamp();
  if ts >= t.ends_at or ts >= p.upload_deadline_at then
    perform public.queue_photo_delete(p_user_id,p_photo_id,'incomplete_upload'); return jsonb_build_object('error','TRIAL_ENDED');
  end if;
  if p_width <= 0 or p_height <= 0 or p_width::bigint * p_height::bigint > 40000000 or p_bytes is distinct from p.byte_size or p_mime is distinct from p.mime_type then raise exception 'INVALID_INPUT'; end if;
  if t.started_at is null then
    update public.trials set started_at = ts, ends_at = ts + make_interval(hours => duration_hours) where id = t.id;
  end if;
  update public.photos set lifecycle = 'ready',width = p_width,height = p_height,ready_at = ts,
    validation_token = null,validation_until = null,updated_at = ts where id = p.id returning * into p;
  return to_jsonb(p);
end;
$$;

create function public.save_note(p_user_id uuid,p_photo_id uuid,p_note_text text,p_expected_version integer,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.photos; note text; ts timestamptz;
begin
  perform public.ensure_profile(p_user_id);
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.lifecycle <> 'ready' then raise exception 'PHOTO_NOT_READY'; end if;
  note := btrim(p_note_text, E' \t\n\r\f' || chr(11) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279));
  if note is null or char_length(note) > 500 or (note = '' and p.preserved_at is null) then raise exception 'INVALID_INPUT'; end if;
  if p.version <> p_expected_version then
    if p.note_text = note and p.preserved_at is not null then return to_jsonb(p); end if;
    return jsonb_build_object('error','VERSION_CONFLICT','current',to_jsonb(p));
  end if;
  if p.note_text = note and p.preserved_at is not null then return to_jsonb(p); end if;
  ts := clock_timestamp();
  update public.photos set note_text = note,preserved_at = coalesce(preserved_at,ts),
    first_note_at = coalesce(first_note_at,ts),version = version + 1,updated_at = ts where id = p.id returning * into p;
  -- 분석 오류가 기능 저장을 롤백하지 않습니다.
  begin
    if (select analytics_consent from public.profiles where user_id = p_user_id) then
      insert into public.events(user_id,trial_id,photo_id,name,client_event_id)
      values (p_user_id,p.trial_id,p.id,'note_saved',p_request_id) on conflict do nothing;
    end if;
  exception when others then null;
  end;
  return to_jsonb(p);
end;
$$;

create function public.mark_viewed(p_user_id uuid,p_photo_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform public.ensure_profile(p_user_id);
  perform 1 from public.photos where id = p_photo_id and user_id = p_user_id and lifecycle = 'ready' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.photos set first_viewed_at = coalesce(first_viewed_at,clock_timestamp()) where id = p_photo_id;
end;
$$;
create function public.set_preferences(p_user_id uuid,p_consent boolean,p_timezone text) returns public.profiles
language plpgsql security invoker set search_path = '' as $$
declare p public.profiles;
begin
  perform public.ensure_profile(p_user_id);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception 'INVALID_INPUT'; end if;
  update public.profiles set analytics_consent = p_consent,timezone = p_timezone where user_id = p_user_id returning * into p;
  if not p_consent then delete from public.events where user_id = p_user_id; end if;
  return p;
end;
$$;
create function public.record_event(p_user_id uuid,p_photo_id uuid,p_name text,p_client_event_id uuid,p_context text)
returns void language plpgsql security invoker set search_path = '' as $$
declare p public.photos;
begin
  perform public.ensure_profile(p_user_id);
  if p_name not in ('photo_viewed','memory_opened','export_generated') or p_context not in ('organic','prompted','unknown') then raise exception 'INVALID_INPUT'; end if;
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id and lifecycle = 'ready';
  if not found then raise exception 'NOT_FOUND'; end if;
  if (select analytics_consent from public.profiles where user_id = p_user_id) then
    insert into public.events(user_id,trial_id,photo_id,name,client_event_id,visit_context)
    values (p_user_id,p.trial_id,p.id,p_name,p_client_event_id,p_context) on conflict do nothing;
  end if;
end;
$$;

create function public.request_account_delete(p_user_id uuid,p_token_hash text) returns public.cleanup_jobs
language plpgsql security invoker set search_path = '' as $$
declare j public.cleanup_jobs; p public.photos;
begin
  perform 1 from public.profiles where user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT'; end if;
  update public.profiles set account_state = 'deleting',analytics_consent = false where user_id = p_user_id;
  for p in select * from public.photos where user_id = p_user_id and lifecycle <> 'deleted' order by id loop
    perform public.queue_photo_delete(p_user_id,p.id,'photo_delete');
  end loop;
  insert into public.cleanup_jobs(user_id,kind,dedupe_key,progress_token_hash,progress_expires_at)
  values (p_user_id,'account_delete','account:' || p_user_id::text,p_token_hash,clock_timestamp() + interval '24 hours')
  on conflict (dedupe_key) do update set progress_token_hash = excluded.progress_token_hash,progress_expires_at = excluded.progress_expires_at
  returning * into j;
  return j;
end;
$$;

-- 원본 파일 제거 후에만 사진 개인정보와 계정 참조를 정리합니다.
create function public.claim_cleanup() returns public.cleanup_jobs language plpgsql security invoker set search_path = '' as $$
declare j public.cleanup_jobs;
begin
  select * into j from public.cleanup_jobs where
    ((status in ('pending','retry') and run_after <= clock_timestamp()) or (status = 'running' and locked_until < clock_timestamp()))
    order by run_after,id for update skip locked limit 1;
  if not found then return null; end if;
  update public.cleanup_jobs set status = 'running',attempts = attempts + 1,
    locked_until = clock_timestamp() + interval '5 minutes',lease_token = gen_random_uuid()
    where id = j.id returning * into j;
  return j;
end;
$$;
create function public.defer_cleanup(p_job_id uuid,p_lease_token uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.cleanup_jobs set status = 'retry',run_after = clock_timestamp() + interval '10 minutes',
    attempts = greatest(attempts - 1,0),locked_until = null,lease_token = null
  where id = p_job_id and status = 'running' and lease_token = p_lease_token and kind = 'account_delete';
  if not found then raise exception 'INVALID_INPUT'; end if;
end;
$$;
create function public.finish_cleanup(p_job_id uuid,p_lease_token uuid,p_success boolean,p_error_code text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare j public.cleanup_jobs;
begin
  select * into j from public.cleanup_jobs where id = p_job_id and status = 'running' and lease_token = p_lease_token for update;
  if not found then raise exception 'INVALID_INPUT'; end if;
  if p_success then
    if j.photo_id is not null then
      update public.photos set lifecycle = 'deleted',note_text = '',original_name = '',deleted_at = clock_timestamp(),
        updated_at = clock_timestamp(),preserved_at = null,first_note_at = null,validation_token = null,validation_until = null
      where id = j.photo_id and lifecycle = 'deleting';
    end if;
    update public.cleanup_jobs set status = 'done',finished_at = clock_timestamp(),error_code = null,
      locked_until = null,lease_token = null,user_id = null,photo_id = null,
      dedupe_key = 'done:' || id::text where id = j.id;
  else
    update public.cleanup_jobs set status = case when attempts >= 5 then 'failed' else 'retry' end,
      run_after = clock_timestamp() + (case attempts when 1 then interval '1 minute' when 2 then interval '5 minutes'
        when 3 then interval '30 minutes' else interval '2 hours' end),
      error_code = case when p_error_code in ('STORAGE_FAILURE','ACCOUNT_PENDING','AUTH_FAILURE','DB_FAILURE') then p_error_code else 'DB_FAILURE' end,
      locked_until = null,lease_token = null where id = j.id;
  end if;
end;
$$;

create function public.sweep_incomplete() returns void language plpgsql security invoker set search_path = '' as $$
declare p public.photos;
begin
  for p in select * from public.photos where lifecycle in ('uploading','failed') and
    upload_deadline_at < clock_timestamp() and preserved_at is null order by user_id,id limit 20 loop
    -- queue 함수가 잠금 뒤 조건을 다시 확인합니다.
    begin perform public.queue_photo_delete(p.user_id,p.id,'incomplete_upload');
    exception when others then null; end;
  end loop;
  delete from public.cleanup_jobs where status = 'done' and kind = 'account_delete' and progress_expires_at < clock_timestamp();
end;
$$;

create function public.purge_account_data(p_user_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.profiles where user_id = p_user_id and account_state = 'deleting' for update;
  if not found then
    if not exists (select 1 from public.profiles where user_id = p_user_id) then return; end if;
    raise exception 'ACCOUNT_DELETING';
  end if;
  if exists (select 1 from public.photos where user_id = p_user_id and lifecycle <> 'deleted') then raise exception 'PHOTO_NOT_READY'; end if;
  delete from public.events where user_id = p_user_id;
  delete from public.photos where user_id = p_user_id;
  delete from public.trials where user_id = p_user_id;
  delete from public.profiles where user_id = p_user_id;
end;
$$;

-- PostgreSQL 기본 PUBLIC EXECUTE를 모든 프로젝트 함수에서 회수합니다.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('app_policy','ensure_profile','me_state','reserve_uploads',
      'queue_photo_delete','claim_upload','release_upload','complete_upload','save_note','mark_viewed','set_preferences',
      'record_event','request_account_delete','claim_cleanup','defer_cleanup','finish_cleanup','sweep_incomplete','purge_account_data') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end;
$$;
