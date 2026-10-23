import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { TablesInsert } from './database.types';
import { errorMessage, supabase } from './supabase';

/**
 * Visits are saved on the phone first and uploaded when there's signal.
 * Barns often have none, so the farrier should never lose a record or
 * wait on the network. Every row carries an id made on the phone, which
 * makes each upload safe to retry.
 */

export type PendingPhoto = { id: string; localUri: string; label: 'before' | 'after' };

export type PendingVisit = {
  visit: Omit<TablesInsert<'visits'>, 'id' | 'season'> & { id: string };
  feet: TablesInsert<'visit_feet'>[];
  flags: { id: string; flag_type: string; notes: string | null }[];
  photos: PendingPhoto[];
  savedAt: string;
};

const KEY = 'outbox.visits.v1';
const BUCKET = 'visit-photos';

type Listener = () => void;
const listeners = new Set<Listener>();
let lastError: string | null = null;

function notify() {
  listeners.forEach((l) => l());
}

export async function listPending(): Promise<PendingVisit[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as PendingVisit[]) : [];
}

async function writePending(items: PendingVisit[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

/** Copies a camera photo out of the cache so the system can't delete it before upload. */
export async function keepPhoto(uri: string, id: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const dir = new Directory(Paths.document, 'pending-photos');
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${id}.jpg`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export async function enqueueVisit(item: PendingVisit) {
  const items = await listPending();
  await writePending([...items.filter((i) => i.visit.id !== item.visit.id), item]);
  syncOutbox();
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

async function upload(item: PendingVisit) {
  const { visit } = item;
  const { error } = await supabase.from('visits').upsert(visit, { onConflict: 'id' });
  if (error) throw error;

  if (item.feet.length) {
    const { error } = await supabase.from('visit_feet').upsert(item.feet, { onConflict: 'visit_id,foot' });
    if (error) throw error;
  }
  if (item.flags.length) {
    const { error } = await supabase
      .from('visit_flags')
      .upsert(item.flags.map((f) => ({ ...f, visit_id: visit.id })), { onConflict: 'id' });
    if (error) throw error;
  }
  for (const photo of item.photos) {
    // Path layout is what the storage policies check: <horse>/<visit>/<file>.
    const path = `${visit.horse_id}/${visit.id}/${photo.id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, await readBytes(photo.localUri), { contentType: 'image/jpeg' });
    // A retry after a dropped connection finds the file already there; that's fine.
    if (uploadError && !/exists|duplicate/i.test(uploadError.message)) throw uploadError;
    const { error } = await supabase
      .from('visit_photos')
      .upsert({ id: photo.id, visit_id: visit.id, storage_path: path, label: photo.label }, { onConflict: 'id' });
    if (error) throw error;
  }
}

function removeLocalPhotos(item: PendingVisit) {
  if (Platform.OS === 'web') return;
  for (const p of item.photos) {
    try {
      const f = new File(p.localUri);
      if (f.exists) f.delete();
    } catch {
      // Leftover files are harmless; don't block the sync on them.
    }
  }
}

let running: Promise<void> | null = null;

/** Uploads every saved visit it can. Safe to call often; runs one pass at a time. */
export function syncOutbox(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      for (const item of await listPending()) {
        try {
          await upload(item);
          removeLocalPhotos(item);
          const rest = (await listPending()).filter((i) => i.visit.id !== item.visit.id);
          await writePending(rest);
          lastError = null;
        } catch (e) {
          // Most failures are no signal. Keep the visit and try again later.
          lastError = errorMessage(e);
          notify();
          return;
        }
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

// Try again whenever the app comes back to the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') syncOutbox();
});

/** Visits still on the phone, kept up to date as they upload. */
export function usePendingVisits() {
  const [items, setItems] = useState<PendingVisit[]>([]);
  const [error, setError] = useState<string | null>(lastError);
  useEffect(() => {
    let alive = true;
    const load = () =>
      listPending().then((next) => {
        if (!alive) return;
        setItems(next);
        setError(lastError);
      });
    listeners.add(load);
    load();
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);
  return { items, error };
}
