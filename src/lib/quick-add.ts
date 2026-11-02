import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type NewBarn = { id: string } | { name: string; address: string | null } | null;

/** Finds the farrier's barn by name (case-insensitive), or creates it, pinning the address when it can. */
async function barnId(barn: NewBarn, userId: string, known: Map<string, string>): Promise<string | null> {
  if (!barn) return null;
  if ('id' in barn) return barn.id;
  const key = barn.name.trim().toLowerCase();
  const existing = known.get(key);
  if (existing) return existing;
  let pin: { latitude: number; longitude: number } | null = null;
  if (barn.address && Platform.OS !== 'web') {
    try {
      const [match] = await Location.geocodeAsync(barn.address);
      if (match) pin = { latitude: match.latitude, longitude: match.longitude };
    } catch {
      // No pin is fine; the farrier can pin it at the barn later.
    }
  }
  const { data, error } = await supabase
    .from('locations')
    .insert({
      name: barn.name.trim(),
      address: barn.address?.trim() || null,
      created_by: userId,
      latitude: pin?.latitude ?? null,
      longitude: pin?.longitude ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  known.set(key, data.id);
  return data.id;
}

/** The farrier's barns by lower-case name, so imports reuse barns instead of duplicating them. */
export async function barnsByName(userId: string) {
  const { data } = await supabase.from('locations').select('id, name').eq('created_by', userId).is('archived_at', null);
  return new Map((data ?? []).map((b) => [b.name.trim().toLowerCase(), b.id]));
}

/**
 * Adds a client with their barn and horses in one go: the quickest way
 * for a new farrier to get their book into the app.
 */
export async function addClientWithHorses(
  input: {
    name: string;
    phone?: string | null;
    email?: string | null;
    barn: NewBarn;
    horses: string[];
    intervalWeeks: number | null;
  },
  userId: string,
  knownBarns: Map<string, string>,
) {
  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      provider_id: userId,
      full_name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const location = await barnId(input.barn, userId, knownBarns);
  for (const name of input.horses.map((h) => h.trim()).filter(Boolean)) {
    const { data: horseId, error: horseError } = await supabase.rpc('create_horse_for_client', {
      p_name: name,
      p_client_id: client.id,
      p_location_id: location ?? undefined,
    });
    if (horseError) throw horseError;
    if (input.intervalWeeks) {
      const { error: intervalError } = await supabase.rpc('set_shoeing_interval', {
        p_horse: horseId,
        p_weeks: input.intervalWeeks,
      });
      if (intervalError) throw intervalError;
    }
  }
  return client.id;
}

/**
 * Reads pasted spreadsheet rows: name, phone, email, horses (separated by
 * ; or /), barn, barn address. Tabs (copied from a spreadsheet) or commas.
 * A header row is skipped.
 */
export function parseRows(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitLine(line, line.includes('\t') ? '\t' : ','));
  if (rows[0] && /name/i.test(rows[0][0]) && !/\d/.test(rows[0].join(''))) rows.shift();
  return rows
    .map(([name = '', phone = '', email = '', horses = '', barn = '', address = '']) => ({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      horses: horses.split(/[;/|]/).map((h) => h.trim()).filter(Boolean),
      barn: barn.trim() ? { name: barn.trim(), address: address.trim() || null } : null,
    }))
    .filter((r) => r.name);
}

/** Splits one CSV line, honouring "quoted, values". */
function splitLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
