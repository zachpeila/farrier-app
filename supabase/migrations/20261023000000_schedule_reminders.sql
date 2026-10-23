-- Runs the send-reminders Edge Function every day at 15:00 UTC
-- (morning across the US and Canada).
--
-- NOT APPLIED YET. Before applying:
--   1. Deploy the function:  supabase functions deploy send-reminders
--   2. Pick a random secret and set it in both places:
--        supabase secrets set CRON_SECRET=<secret>
--        select vault.create_secret('<secret>', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '0 15 * * *',
  $$
  select net.http_post(
    url     := 'https://bvtwxbcnswkzskyahdfs.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := '{}'::jsonb
  );
  $$
);
