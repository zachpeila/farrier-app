-- Push and email the other side when a visit request or client request is
-- sent, answered or cancelled. The trigger only queues an HTTP call (pg_net
-- runs it after commit), so a slow or failed notification never blocks the
-- request itself. The notify-request Edge Function does the sending.

create or replace function public.queue_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefix text := case tg_table_name when 'visit_requests' then 'visit_request' else 'client_request' end;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    if new.status::text <> 'pending' then return new; end if;
    v_kind := prefix || '_received';
  elsif new.status::text is distinct from old.status::text then
    v_kind := prefix || '_' || new.status::text;  -- accepted, declined, cancelled
  else
    return new;  -- message edits and re-sends don't notify again
  end if;

  -- Owners cancelling a client request isn't worth a ping.
  if v_kind = 'client_request_cancelled' then return new; end if;

  perform net.http_post(
    url     := 'https://bvtwxbcnswkzskyahdfs.supabase.co/functions/v1/notify-request',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := jsonb_build_object('table', tg_table_name, 'id', new.id, 'kind', v_kind)
  );
  return new;
end $$;

revoke execute on function public.queue_request_notification() from public, anon, authenticated;

drop trigger if exists visit_requests_notify on public.visit_requests;
create trigger visit_requests_notify
  after insert or update of status on public.visit_requests
  for each row execute function public.queue_request_notification();

drop trigger if exists client_requests_notify on public.client_requests;
create trigger client_requests_notify
  after insert or update of status on public.client_requests
  for each row execute function public.queue_request_notification();
