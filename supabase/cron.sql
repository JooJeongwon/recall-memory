-- 운영자가 프로젝트 URL과 Vault의 비밀을 구성한 뒤 개발 환경에서 먼저 확인합니다.
-- migration에 자동 포함하지 않습니다. Extensions에서 pg_cron, pg_net을 활성화해야 합니다.
-- Vault 이름: recall_project_url, recall_maintenance_secret.
select cron.schedule('recall-maintenance', '*/10 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'recall_project_url') || '/functions/v1/maintenance',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'recall_maintenance_secret')),
    body := '{}'::jsonb
  );
$$);
