-- 1. Helper: may the current user send a visit request to this provider for this horse?
create or replace function public.can_request_provider(p_horse uuid, p_provider uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_provider <> auth.uid()
     and (
       exists (select 1 from profiles p where p.id = p_provider and p.listed)
       or exists (select 1 from horse_providers hp
                   where hp.horse_id = p_horse and hp.user_id = p_provider and hp.status = 'active')
     );
$$;
revoke execute on function public.can_request_provider(uuid, uuid) from public, anon;
grant execute on function public.can_request_provider(uuid, uuid) to authenticated;

-- 2. Visit requests may only target listed farriers or the horse's own attached providers
drop policy if exists requests_insert on public.visit_requests;
create policy requests_insert on public.visit_requests
  for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and is_horse_owner(horse_id)
    and status = 'pending'::request_status
    and can_request_provider(horse_id, requested_provider_id)
  );

-- 3. find_people: only listed providers, or people you are already connected to
create or replace function public.find_people(p_query text)
returns table(id uuid, full_name text, business_name text, avatar_path text, service_area text)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.full_name, p.business_name, p.avatar_path, p.service_area
    from profiles p
   where auth.uid() is not null
     and length(trim(p_query)) >= 2
     and p.id <> auth.uid()
     and (p.listed or shares_connection(p.id))
     and (p.full_name ilike '%' || trim(p_query) || '%'
          or p.business_name ilike '%' || trim(p_query) || '%')
   order by p.business_name nulls last, p.full_name
   limit 25;
$$;

-- 4. find_farriers: whole-km distances so a farrier's base can't be triangulated
create or replace function public.find_farriers(p_lat double precision, p_lng double precision)
returns table(id uuid, name text, service_area text, region text, distance_km double precision, accepting boolean, services text[], years_experience integer, certifications text, bio text, price_from_cents integer, currency text, already_mine boolean, requested boolean)
language sql stable security definer
set search_path = public
as $$
  select p.id,
         coalesce(nullif(p.business_name, ''), p.full_name),
         p.service_area, p.region,
         greatest(1, round(km_between(p_lat, p_lng, p.base_latitude, p.base_longitude)))::double precision,
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

-- 5. Notification types for Request Visit and client requests
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'due_soon','appointment_proposed','appointment_reminder','invoice_unpaid',
    'visit_request_received','visit_request_accepted','visit_request_declined','visit_request_cancelled',
    'client_request_received','client_request_accepted','client_request_declined'
  ]));

-- 6. Pin km_between's search_path (security advisor warning)
alter function public.km_between(double precision, double precision, double precision, double precision)
  set search_path = public;
