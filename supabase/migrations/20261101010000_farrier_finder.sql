-- Owners find farriers near them. Farriers opt in to a listing with a home
-- base and how far they travel; owners search by their barn's location and
-- ask to become a client, which the farrier accepts or declines.

alter table public.profiles
  add column listed boolean not null default false,
  add column accepting_clients boolean not null default true,
  add column base_latitude double precision,
  add column base_longitude double precision,
  add column travel_km integer check (travel_km between 5 and 500),
  add column services text[] not null default '{}',
  add column years_experience integer check (years_experience between 0 and 80),
  add column certifications text,
  add column bio text,
  add column show_prices boolean not null default false;

create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index client_requests_open on public.client_requests (owner_id, provider_id, horse_id) where status = 'pending';
alter table public.client_requests enable row level security;
create policy client_requests_select on public.client_requests
  for select using (owner_id = auth.uid() or provider_id = auth.uid());

-- Straight-line distance in km between two points.
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Listed farriers whose travel area covers the point, nearest first.
create or replace function public.find_farriers(p_lat double precision, p_lng double precision)
returns table (
  id uuid, name text, service_area text, region text, distance_km double precision,
  accepting boolean, services text[], years_experience integer, certifications text, bio text,
  price_from_cents integer, currency text, already_mine boolean, requested boolean
)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(p.business_name, ''), p.full_name),
         p.service_area, p.region,
         round(km_between(p_lat, p_lng, p.base_latitude, p.base_longitude)::numeric, 1)::double precision,
         p.accepting_clients, p.services, p.years_experience, p.certifications, p.bio,
         case when p.show_prices then (select min(s.price_cents) from provider_services s
                                        where s.provider_id = p.id and s.active and s.price_cents > 0) end,
         p.default_currency,
         exists (select 1 from horse_providers hp join horse_owners ho on ho.horse_id = hp.horse_id
                  where hp.user_id = p.id and hp.status = 'active' and ho.user_id = auth.uid()),
         exists (select 1 from client_requests r
                  where r.provider_id = p.id and r.owner_id = auth.uid() and r.status = 'pending')
    from profiles p
   where auth.uid() is not null
     and p.listed and p.base_latitude is not null and p.base_longitude is not null
     and p.id <> auth.uid()
     and km_between(p_lat, p_lng, p.base_latitude, p.base_longitude) <= coalesce(p.travel_km, 50)
   order by 5
   limit 50
$$;

create or replace function public.request_farrier(p_provider uuid, p_horse uuid, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from horse_owners where horse_id = p_horse and user_id = auth.uid()) then
    raise exception 'horse not found';
  end if;
  if not exists (select 1 from profiles where id = p_provider and listed and accepting_clients) then
    raise exception 'This farrier is not taking new clients right now.';
  end if;
  insert into client_requests (owner_id, provider_id, horse_id, message)
  values (auth.uid(), p_provider, p_horse, nullif(trim(p_message), ''))
  on conflict (owner_id, provider_id, horse_id) where status = 'pending'
  do update set message = excluded.message
  returning id into v_id;
  return v_id;
end $$;

-- The farrier's open requests, with what they need to decide.
create or replace function public.incoming_client_requests()
returns table (id uuid, owner_name text, owner_phone text, horse_id uuid, horse_name text,
               barn_name text, barn_address text, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, p.full_name, p.phone, h.id, h.name, l.name, l.address, r.message, r.created_at
    from client_requests r
    join profiles p on p.id = r.owner_id
    join horses h on h.id = r.horse_id
    left join locations l on l.id = h.location_id
   where r.provider_id = auth.uid() and r.status = 'pending'
   order by r.created_at
$$;

-- The owner's requests, with the farrier's name.
create or replace function public.my_farrier_requests()
returns table (id uuid, farrier_name text, horse_name text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, coalesce(nullif(p.business_name, ''), p.full_name), h.name, r.status, r.created_at
    from client_requests r
    join profiles p on p.id = r.provider_id
    join horses h on h.id = r.horse_id
   where r.owner_id = auth.uid() and r.created_at > now() - interval '60 days'
   order by r.created_at desc
$$;

-- Accepting makes the owner a client and the farrier the horse's farrier,
-- the same as accepting an owner's invite.
create or replace function public.respond_client_request(p_request uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare r client_requests; c uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into r from client_requests where id = p_request and provider_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'request not found'; end if;

  if p_accept then
    insert into horse_providers (horse_id, user_id, role, attached_by)
    values (r.horse_id, auth.uid(), 'farrier', r.owner_id)
    on conflict (horse_id, user_id, role) where status = 'active' do nothing;

    insert into clients (provider_id, linked_user_id, full_name, phone, email)
    select auth.uid(), p.id, coalesce(nullif(p.full_name, ''), 'Owner'), p.phone, p.email
      from profiles p where p.id = r.owner_id
    on conflict (provider_id, linked_user_id) do nothing;
    select id into c from clients where provider_id = auth.uid() and linked_user_id = r.owner_id;

    update horse_owners set client_id = c
     where horse_id = r.horse_id and user_id = r.owner_id and client_id is null;
  end if;

  update client_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where id = r.id;
  return r.horse_id;
end $$;

create or replace function public.cancel_client_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update client_requests set status = 'cancelled', responded_at = now()
   where id = p_request and owner_id = auth.uid() and status = 'pending';
  if not found then raise exception 'request not found'; end if;
end $$;

revoke execute on function public.find_farriers(double precision, double precision) from anon, public;
revoke execute on function public.request_farrier(uuid, uuid, text) from anon, public;
revoke execute on function public.incoming_client_requests() from anon, public;
revoke execute on function public.my_farrier_requests() from anon, public;
revoke execute on function public.respond_client_request(uuid, boolean) from anon, public;
revoke execute on function public.cancel_client_request(uuid) from anon, public;
grant execute on function public.find_farriers(double precision, double precision) to authenticated;
grant execute on function public.request_farrier(uuid, uuid, text) to authenticated;
grant execute on function public.incoming_client_requests() to authenticated;
grant execute on function public.my_farrier_requests() to authenticated;
grant execute on function public.respond_client_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_client_request(uuid) to authenticated;
