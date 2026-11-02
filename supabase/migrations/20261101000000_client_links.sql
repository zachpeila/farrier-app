-- Reaching clients who aren't on the app, plus a few owner-side fields.
--
-- * public_links: an unguessable token per (client, visit) or (client,
--   invoice). The token is the link texted or emailed to the owner; the
--   public-link Edge Function reads it with the service role, so these
--   rows are never readable by token from the client side.
-- * client_messages: log of texts/emails sent to clients, so reminders
--   aren't repeated (notifications only covers people with accounts).
-- * appointments.owner_change_*: owner asks for a different time.
-- * appointment_horses.owner_note: owner's concern for that horse.
-- * horses.vet_*: who to call if something is wrong.

create table public.public_links (
  token uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((appointment_id is null) <> (invoice_id is null))
);
create unique index public_links_appt on public.public_links (client_id, appointment_id) where appointment_id is not null;
create unique index public_links_invoice on public.public_links (client_id, invoice_id) where invoice_id is not null;
alter table public.public_links enable row level security;
create policy public_links_provider on public.public_links
  for select using (provider_id = auth.uid());

create table public.client_messages (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null,
  channel text not null,
  appointment_id uuid references public.appointments(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index client_messages_client on public.client_messages (client_id, kind, sent_at);
alter table public.client_messages enable row level security;
create policy client_messages_provider on public.client_messages
  for all using (provider_id = auth.uid()) with check (provider_id = auth.uid());

alter table public.appointments
  add column owner_change_request text,
  add column owner_change_requested_at timestamptz;
alter table public.appointment_horses add column owner_note text;
alter table public.horses
  add column vet_name text,
  add column vet_phone text;

-- A new time from the farrier answers any change request.
create or replace function public.reset_owner_confirmation() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.scheduled_start is distinct from old.scheduled_start
     or new.scheduled_end is distinct from old.scheduled_end then
    new.owner_confirmed_at := null;
    new.owner_change_request := null;
    new.owner_change_requested_at := null;
  end if;
  return new;
end $$;

-- The farrier gets (or makes) the link for one client and a visit or invoice.
create or replace function public.client_link(p_client uuid, p_appointment uuid default null, p_invoice uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from clients where id = p_client and provider_id = auth.uid()) then
    raise exception 'client not found';
  end if;
  if p_appointment is not null then
    if not exists (select 1 from appointments where id = p_appointment and provider_id = auth.uid()) then
      raise exception 'visit not found';
    end if;
    select token into v_token from public_links where client_id = p_client and appointment_id = p_appointment;
  elsif p_invoice is not null then
    if not exists (select 1 from invoices where id = p_invoice and provider_id = auth.uid() and client_id = p_client) then
      raise exception 'invoice not found';
    end if;
    select token into v_token from public_links where client_id = p_client and invoice_id = p_invoice;
  else
    raise exception 'need a visit or an invoice';
  end if;
  if v_token is null then
    insert into public_links (provider_id, client_id, appointment_id, invoice_id)
    values (auth.uid(), p_client, p_appointment, p_invoice)
    returning token into v_token;
  end if;
  return v_token;
end $$;
revoke execute on function public.client_link(uuid, uuid, uuid) from anon, public;
grant execute on function public.client_link(uuid, uuid, uuid) to authenticated;

-- Owners on the app: ask for a different time, and leave a note per horse.
create or replace function public.request_appointment_change(p_appointment uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from appointment_horses ah join horse_owners ho on ho.horse_id = ah.horse_id
                  where ah.appointment_id = p_appointment and ho.user_id = auth.uid()) then
    raise exception 'appointment not found';
  end if;
  update appointments
     set owner_change_request = nullif(trim(p_message), ''),
         owner_change_requested_at = case when nullif(trim(p_message), '') is null then null else now() end,
         owner_confirmed_at = null
   where id = p_appointment and status = 'scheduled';
  if not found then raise exception 'appointment is not scheduled'; end if;
end $$;

create or replace function public.set_appointment_horse_note(p_appointment uuid, p_horse uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from horse_owners where horse_id = p_horse and user_id = auth.uid()) then
    raise exception 'horse not found';
  end if;
  update appointment_horses set owner_note = nullif(trim(p_note), '')
   where appointment_id = p_appointment and horse_id = p_horse;
  if not found then raise exception 'horse is not on this visit'; end if;
end $$;
revoke execute on function public.request_appointment_change(uuid, text) from anon, public;
revoke execute on function public.set_appointment_horse_note(uuid, uuid, text) from anon, public;
grant execute on function public.request_appointment_change(uuid, text) to authenticated;
grant execute on function public.set_appointment_horse_note(uuid, uuid, text) to authenticated;
