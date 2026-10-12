alter table public.photos
  add column second_note_text text not null default '' check (char_length(second_note_text) <= 500),
  add column second_note_at timestamptz;

do $$
declare c record;
begin
  for c in select conname from pg_catalog.pg_constraint
    where conrelid = 'public.photos'::regclass and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%preserved_at%'
      and conname <> 'photos_soft_deleted_timestamp_check'
  loop
    execute format('alter table public.photos drop constraint %I', c.conname);
  end loop;
end;
$$;

update public.photos set preserved_at = null, version = version + 1 where preserved_at is not null;

alter table public.photos
  add constraint photos_first_note_state_check
    check (first_note_at is not null or (note_text = '' and second_note_at is null)),
  add constraint photos_second_note_state_check
    check (second_note_at is not null or second_note_text = ''),
  add constraint photos_preservation_state_check
    check ((preserved_at is null) = (second_note_at is null)),
  add constraint photos_second_note_requires_first_check
    check (second_note_at is null or first_note_at is not null);

alter table public.cleanup_jobs drop constraint cleanup_jobs_kind_check;
alter table public.cleanup_jobs add constraint cleanup_jobs_kind_check
  check (kind in ('photo_delete','account_delete','incomplete_upload','retention_expired'));

create index photos_first_note_deadline on public.photos(ready_at)
  where lifecycle in ('ready','soft_deleted') and first_note_at is null and preserved_at is null;
create index photos_second_note_deadline on public.photos(first_note_at)
  where lifecycle in ('ready','soft_deleted') and first_note_at is not null and second_note_at is null and preserved_at is null;

create or replace function public.app_policy() returns jsonb language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('trialHours',48,'firstNoteHours',24,'secondNoteHours',48,'maxPhotos',20,'maxBatch',10,'maxBytes',10485760,
    'maxPixels',40000000,'noteLength',500,'reservationHours',24,'bucket','memory-assets');
$$;

create or replace function public.queue_photo_delete(p_user_id uuid, p_photo_id uuid, p_kind text default 'photo_delete') returns public.cleanup_jobs
language plpgsql security invoker set search_path = '' as $$
declare p public.photos; j public.cleanup_jobs;
begin
  perform 1 from public.profiles where user_id = p_user_id for update;
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_kind not in ('photo_delete','incomplete_upload','retention_expired') then raise exception 'INVALID_INPUT'; end if;
  select * into j from public.cleanup_jobs where dedupe_key = 'photo:' || p.id::text;
  if found then return j; end if;
  if p.lifecycle = 'deleted' then return null; end if;
  if p_kind = 'incomplete_upload' and (p.lifecycle not in ('uploading','failed') or p.preserved_at is not null) then raise exception 'PHOTO_NOT_READY'; end if;
  if p_kind = 'retention_expired' and (p.lifecycle not in ('ready','soft_deleted') or p.preserved_at is not null or not (
    (p.first_note_at is null and p.ready_at <= clock_timestamp() - interval '24 hours') or
    (p.first_note_at is not null and p.second_note_at is null and p.first_note_at <= clock_timestamp() - interval '48 hours')
  )) then raise exception 'PHOTO_NOT_READY'; end if;
  update public.photos set lifecycle = 'deleting', delete_requested_at = clock_timestamp(), version = version + 1,
    updated_at = clock_timestamp() where id = p.id;
  insert into public.cleanup_jobs(user_id,photo_id,kind,dedupe_key,run_after)
  values (p_user_id,p.id,p_kind,'photo:' || p.id::text,
    greatest(clock_timestamp(),p.created_at + interval '2 hours 5 minutes',
      case when p.ready_at is null then clock_timestamp() + interval '2 hours 5 minutes' else p.ready_at + interval '2 hours 5 minutes' end,
      coalesce(p.validation_until,clock_timestamp()) + interval '5 minutes')) returning * into j;
  return j;
end;
$$;

drop function public.save_note(uuid,uuid,text,integer,uuid);
create function public.save_note(p_user_id uuid,p_photo_id uuid,p_note_text text,p_expected_version integer,p_request_id uuid,p_note_stage text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.photos; note text; ts timestamptz; stage text; current_note text; stage_saved_at timestamptz;
begin
  perform public.ensure_profile(p_user_id);
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.lifecycle <> 'ready' then raise exception 'PHOTO_NOT_READY'; end if;
  if p_note_stage is null or p_note_stage not in ('first','second') then raise exception 'INVALID_INPUT'; end if;
  ts := clock_timestamp();
  if (p.first_note_at is null and ts >= p.ready_at + interval '24 hours') or
    (p.first_note_at is not null and p.second_note_at is null and ts >= p.first_note_at + interval '48 hours') then
    perform public.queue_photo_delete(p_user_id,p_photo_id,'retention_expired');
    return jsonb_build_object('error','PHOTO_EXPIRED');
  end if;
  stage := p_note_stage;
  if stage = 'second' and p.first_note_at is null then raise exception 'INVALID_INPUT'; end if;
  note := btrim(p_note_text, E' \t\n\r\f' || chr(11) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279));
  if note is null or char_length(note) > 500 or (note = '' and p.preserved_at is null) then raise exception 'INVALID_INPUT'; end if;
  current_note := case when stage = 'first' then p.note_text else p.second_note_text end;
  stage_saved_at := case when stage = 'first' then p.first_note_at else p.second_note_at end;
  if p.version <> p_expected_version then
    if current_note = note and stage_saved_at is not null then return to_jsonb(p); end if;
    return jsonb_build_object('error','VERSION_CONFLICT','current',to_jsonb(p));
  end if;
  if current_note = note and stage_saved_at is not null then return to_jsonb(p); end if;
  if stage = 'first' then
    update public.photos set note_text = note,first_note_at = coalesce(first_note_at,ts),
      version = version + 1,updated_at = ts where id = p.id returning * into p;
  else
    update public.photos set second_note_text = note,second_note_at = coalesce(second_note_at,ts),
      preserved_at = coalesce(preserved_at,ts),version = version + 1,updated_at = ts where id = p.id returning * into p;
  end if;
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

create or replace function public.finish_cleanup(p_job_id uuid,p_lease_token uuid,p_success boolean,p_error_code text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare j public.cleanup_jobs;
begin
  select * into j from public.cleanup_jobs where id = p_job_id and status = 'running' and lease_token = p_lease_token for update;
  if not found then raise exception 'INVALID_INPUT'; end if;
  if p_success then
    if j.photo_id is not null then
      update public.photos set lifecycle = 'deleted',note_text = '',second_note_text = '',original_name = '',deleted_at = clock_timestamp(),
        updated_at = clock_timestamp(),preserved_at = null,first_note_at = null,second_note_at = null,validation_token = null,validation_until = null
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

create or replace function public.sweep_incomplete() returns void language plpgsql security invoker set search_path = '' as $$
declare p public.photos;
begin
  for p in select * from public.photos where lifecycle in ('uploading','failed') and
    upload_deadline_at < clock_timestamp() and preserved_at is null order by user_id,id limit 20 loop
    begin perform public.queue_photo_delete(p.user_id,p.id,'incomplete_upload');
    exception when others then null; end;
  end loop;
  for p in select * from public.photos where lifecycle in ('ready','soft_deleted') and preserved_at is null and (
    (first_note_at is null and ready_at <= clock_timestamp() - interval '24 hours') or
    (first_note_at is not null and second_note_at is null and first_note_at <= clock_timestamp() - interval '48 hours')
  ) order by user_id,id limit 20 loop
    begin perform public.queue_photo_delete(p.user_id,p.id,'retention_expired');
    exception when others then null; end;
  end loop;
  delete from public.cleanup_jobs where status = 'done' and kind = 'account_delete' and progress_expires_at < clock_timestamp();
end;
$$;

revoke all on function public.save_note(uuid,uuid,text,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.save_note(uuid,uuid,text,integer,uuid,text) to service_role;
