import { supabase } from './supabase';

/** Every horse the signed-in person can see (as owner or provider), with barn, owners and providers. */
export async function fetchHorses() {
  const { data, error } = await supabase
    .from('horses')
    .select(
      `*, locations(id, name),
       horse_owners(client_id, user_id, clients(full_name)),
       horse_providers(user_id, role, status, interval_weeks)`,
    )
    .is('archived_at', null)
    .order('name');
  if (error) throw error;
  return data;
}
export type HorseListItem = Awaited<ReturnType<typeof fetchHorses>>[number];

export async function fetchHorse(id: string) {
  const { data, error } = await supabase
    .from('horses')
    .select(
      `*, locations(id, name, address),
       horse_owners(id, client_id, user_id, clients(id, full_name)),
       horse_providers(id, user_id, role, status, interval_weeks, profiles!horse_providers_user_id_fkey(full_name, business_name, phone))`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
export type HorseDetail = Awaited<ReturnType<typeof fetchHorse>>;

/** Barns the person created. Barns of other people's horses show up through the horse instead. */
export async function fetchMyBarns(userId: string) {
  const { data, error } = await supabase
    .from('locations')
    .select('*, horses(id)')
    .eq('created_by', userId)
    .is('archived_at', null)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchClients(userId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('*, horse_owners(horse_id)')
    .eq('provider_id', userId)
    .is('archived_at', null)
    .order('full_name');
  if (error) throw error;
  return data;
}

/** The farrier's due list, with each horse's barn and owner names attached. */
export async function fetchDueList(userId: string) {
  const { data: due, error } = await supabase.from('due_horses').select('*').eq('provider_id', userId);
  if (error) throw error;

  const horseIds = due.map((d) => d.horse_id!).filter(Boolean);
  const locationIds = [...new Set(due.map((d) => d.location_id).filter((x): x is string => !!x))];

  const [owners, barns] = await Promise.all([
    horseIds.length
      ? supabase.from('horse_owners').select('horse_id, clients(full_name)').in('horse_id', horseIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length
      ? supabase.from('locations').select('id, name, address').in('id', locationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (owners.error) throw owners.error;
  if (barns.error) throw barns.error;

  const ownerNames = new Map<string, string[]>();
  for (const o of owners.data ?? []) {
    const name = o.clients?.full_name;
    if (!name) continue;
    ownerNames.set(o.horse_id, [...(ownerNames.get(o.horse_id) ?? []), name]);
  }
  const barnById = new Map((barns.data ?? []).map((b) => [b.id, b]));

  return due.map((d) => ({
    ...d,
    owners: ownerNames.get(d.horse_id!) ?? [],
    barn: d.location_id ? barnById.get(d.location_id) ?? null : null,
  }));
}
export type DueItem = Awaited<ReturnType<typeof fetchDueList>>[number];
