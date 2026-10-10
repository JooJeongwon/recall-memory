-- 프로젝트 URL과 Vault 비밀을 설정한 뒤 프로젝트마다 한 번만 실행합니다.
-- 이미 recall-maintenance 일정이 있으면 다시 실행하지 않습니다.
-- migration에 자동 포함하지 않습니다. Supabase Cron 설치 절차에 맞춰 확장을 준비합니다.
-- Vault 이름: recall_project_url, recall_maintenance_secret.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
-- Supabase manages cron table privileges; schedule jobs through cron.schedule().
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule('recall-maintenance', '*/10 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'recall_project_url') || '/functions/v1/maintenance',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'recall_maintenance_secret')),
    body := '{}'::jsonb
  );
$$);
