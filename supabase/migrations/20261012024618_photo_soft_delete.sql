alter table public.photos drop constraint photos_lifecycle_check;
alter table public.photos add constraint photos_lifecycle_check
  check (lifecycle in ('uploading','ready','failed','deleting','deleted','soft_deleted'));
alter table public.photos add constraint photos_soft_deleted_timestamp_check
  check (lifecycle <> 'soft_deleted' or delete_requested_at is not null);

create function public.soft_delete_photo(p_user_id uuid,p_photo_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare p public.photos;
begin
  perform public.ensure_profile(p_user_id);
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.lifecycle = 'soft_deleted' then return; end if;
  if p.lifecycle <> 'ready' then raise exception 'PHOTO_NOT_READY'; end if;
  update public.photos set lifecycle = 'soft_deleted',delete_requested_at = clock_timestamp(),
    version = version + 1,updated_at = clock_timestamp() where id = p.id;
end;
$$;

create function public.restore_photo(p_user_id uuid,p_photo_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare p public.photos;
begin
  perform public.ensure_profile(p_user_id);
  select * into p from public.photos where id = p_photo_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.lifecycle = 'ready' then return; end if;
  if p.lifecycle <> 'soft_deleted' then raise exception 'PHOTO_NOT_READY'; end if;
  update public.photos set lifecycle = 'ready',delete_requested_at = null,
    version = version + 1,updated_at = clock_timestamp() where id = p.id;
end;
$$;

revoke all on function public.soft_delete_photo(uuid,uuid) from public, anon, authenticated;
revoke all on function public.restore_photo(uuid,uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_photo(uuid,uuid) to service_role;
grant execute on function public.restore_photo(uuid,uuid) to service_role;
