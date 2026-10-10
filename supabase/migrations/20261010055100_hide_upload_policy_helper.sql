drop policy memory_assets_reserved_upload on storage.objects;
drop function public.can_upload_reserved_object(text);
create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;
create function private.can_upload_reserved_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.photos p
    join public.trials t on t.id = p.trial_id and t.user_id = p.user_id
    join public.profiles pr on pr.user_id = p.user_id
    where p.user_id = (select auth.uid()) and p.original_key = p_name and p.lifecycle = 'uploading'
      and p.upload_deadline_at > pg_catalog.statement_timestamp()
      and (t.ends_at is null or t.ends_at > pg_catalog.statement_timestamp())
      and pr.account_state = 'active');
$$;
revoke all on function private.can_upload_reserved_object(text) from public, anon, authenticated, service_role;
grant execute on function private.can_upload_reserved_object(text) to authenticated;
create policy memory_assets_reserved_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'memory-assets' and private.can_upload_reserved_object(name)
);
