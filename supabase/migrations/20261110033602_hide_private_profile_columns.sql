-- Other users may read only these profile columns (row access is still limited by RLS to people you're connected with).
-- Hidden from everyone but the owner: base_latitude, base_longitude, stripe_account_id.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, full_name, business_name, phone, email, avatar_path, bio, certifications,
  country, region, service_area, services, years_experience, listed, accepting_clients,
  show_prices, default_currency, distance_unit, timezone, travel_km, trip_fee_cents,
  stripe_charges_enabled, stripe_payouts_enabled, created_at, updated_at
) on public.profiles to authenticated;

-- The signed-in user's own full profile, including the hidden columns.
create or replace function public.get_my_profile()
returns setof public.profiles
language sql stable security definer
set search_path = public
as $$
  select * from profiles where id = (select auth.uid());
$$;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
