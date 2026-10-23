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

const APPOINTMENT_SELECT = `*, locations(id, name, address),
  appointment_horses(horse_id, horses(id, name)),
  profiles!appointments_provider_id_fkey(full_name, business_name, phone)`;

/** Appointments from today on that the person can see: their own as farrier, or their horses' as owner. */
export async function fetchUpcomingAppointments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .gte('scheduled_start', today.toISOString())
    .eq('status', 'scheduled')
    .order('scheduled_start');
  if (error) throw error;
  return data;
}
export type AppointmentItem = Awaited<ReturnType<typeof fetchUpcomingAppointments>>[number];

export async function fetchAppointment(id: string) {
  const { data, error } = await supabase.from('appointments').select(APPOINTMENT_SELECT).eq('id', id).single();
  if (error) throw error;
  return data;
}

/** Visit requests sent to or by the person that still need something to happen. */
export async function fetchOpenRequests() {
  const { data, error } = await supabase
    .from('visit_requests')
    .select(
      `*, horses(id, name, location_id, locations(id, name)),
       requester:profiles!visit_requests_requested_by_fkey(full_name, phone),
       provider:profiles!visit_requests_requested_provider_id_fkey(full_name, business_name)`,
    )
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export type RequestItem = Awaited<ReturnType<typeof fetchOpenRequests>>[number];

/** The farrier's stops for one day, in route order (then by arrival window). */
export async function fetchDayStops(userId: string, day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, locations(id, name, address, latitude, longitude), appointment_horses(horse_id, horses(id, name))`)
    .eq('provider_id', userId)
    .eq('status', 'scheduled')
    .gte('scheduled_start', start.toISOString())
    .lt('scheduled_start', end.toISOString())
    .order('route_order', { nullsFirst: false })
    .order('scheduled_start');
  if (error) throw error;
  return data;
}
export type DayStop = Awaited<ReturnType<typeof fetchDayStops>>[number];

/** A horse's visit history the person is allowed to see, newest first. */
export async function fetchHorseVisits(horseId: string) {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `id, visit_date, visit_type, work_type, is_flagged, shared_with_owner, provider_id,
       visit_flags(flag_type), visit_photos(id),
       profiles!visits_provider_id_fkey(full_name, business_name)`,
    )
    .eq('horse_id', horseId)
    .order('visit_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchVisit(id: string) {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `*, horses(id, name), visit_feet(*), visit_flags(*), visit_photos(*),
       profiles!visits_provider_id_fkey(full_name, business_name)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const paths = data.visit_photos.map((p) => p.storage_path);
  const signed = paths.length
    ? (await supabase.storage.from('visit-photos').createSignedUrls(paths, 60 * 60)).data ?? []
    : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return {
    ...data,
    visit_photos: data.visit_photos.map((p) => ({ ...p, url: urlByPath.get(p.storage_path) ?? null })),
  };
}

export async function fetchBillingSettings(userId: string) {
  const [services, taxes] = await Promise.all([
    supabase.from('provider_services').select('*').eq('provider_id', userId).order('sort_order').order('name'),
    supabase.from('tax_rates').select('*').eq('provider_id', userId).order('sort_order').order('name'),
  ]);
  if (services.error) throw services.error;
  if (taxes.error) throw taxes.error;
  return { services: services.data, taxes: taxes.data };
}

const INVOICE_LIST_SELECT = `id, invoice_number, status, total_cents, amount_paid_cents, currency, due_date,
  created_at, provider_id, clients(id, full_name),
  profiles!invoices_provider_id_fkey(full_name, business_name)`;

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_LIST_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}
export type InvoiceListItem = Awaited<ReturnType<typeof fetchInvoices>>[number];

export async function fetchInvoice(id: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      `*, clients(id, full_name, email, phone),
       profiles!invoices_provider_id_fkey(full_name, business_name, phone, email),
       invoice_line_items(*), payments(id, amount_cents, method, status, paid_at)`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    ...data,
    invoice_line_items: [...data.invoice_line_items].sort((a, b) => a.sort_order - b.sort_order),
  };
}
export type InvoiceDetail = Awaited<ReturnType<typeof fetchInvoice>>;
