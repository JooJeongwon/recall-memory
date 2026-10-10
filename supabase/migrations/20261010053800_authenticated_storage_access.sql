create function public.can_upload_reserved_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.photos p
    join public.trials t on t.id = p.trial_id and t.user_id = p.user_id
    join public.profiles pr on pr.user_id = p.user_id
    where p.user_id = (select auth.uid()) and p.original_key = p_name and p.lifecycle = 'uploading'
      and p.upload_deadline_at > pg_catalog.statement_timestamp() and t.ends_at > pg_catalog.statement_timestamp()
      and pr.account_state = 'active');
$$;
revoke all on function public.can_upload_reserved_object(text) from public, anon, authenticated;
grant execute on function public.can_upload_reserved_object(text) to authenticated;
create policy memory_assets_reserved_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'memory-assets' and public.can_upload_reserved_object(name)
);

create or replace function public.app_policy() returns jsonb language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('trialHours',48,'maxPhotos',20,'maxBatch',10,'maxBytes',10485760,
    'maxPixels',40000000,'noteLength',500,'reservationHours',24,'bucket','memory-assets');
$$;
