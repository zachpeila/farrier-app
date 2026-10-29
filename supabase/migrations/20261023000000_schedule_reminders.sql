-- Runs the send-reminders Edge Function every day at 15:00 UTC
-- (morning across the US and Canada).
--
-- The shared secret is generated here and kept only in the vault. The
-- function checks the header with check_cron_secret(), which only the
-- service role can call.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret')
where not exists (select 1 from vault.secrets where name = 'cron_secret');

create or replace function public.check_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_secret
  );
$$;

revoke execute on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

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
