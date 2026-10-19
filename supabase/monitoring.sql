-- Run separately after enabling pg_cron and pg_net in Supabase.
-- Store capgap_monitor_secret and capgap_app_url in Supabase Vault before scheduling.
select cron.schedule('capgap-monitor','* * * * *',$$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='capgap_app_url') || '/api/v1/monitor',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='capgap_monitor_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 60000
);
$$);
select cron.schedule('capgap-retention','15 3 * * *','select public.prune_observations()');
