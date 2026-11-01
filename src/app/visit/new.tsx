import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  DateStepper,
  ErrorText,
  Field,
  Loading,
  MultiSelect,
  Screen,
  SectionTitle,
  Segmented,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { enqueueVisit, keepPhoto, listPending, type PendingPhoto } from '@/lib/outbox';
import { addDays, formatDay, startOfDay, toDateString } from '@/lib/schedule';
import { errorMessage, supabase } from '@/lib/supabase';
import {
  FEET,
  FLAG_TYPES,
  FOOT_WORK,
  footWorkFor,
  GROUND,
  WORK_TYPES,
  type Foot,
} from '@/lib/visit-options';

type FootForm = {
  work: string;
  shoe_make: string;
  shoe_size: string;
  modifications: string;
  pads: string;
  findings: string;
};

const SHOD = ['reset', 'new_shoe'];
const NEXT_DUE_WEEKS = [4, 5, 6, 7, 8, 10, 12].map((w) => ({ value: String(w), label: `${w} wk` }));

function blankFoot(work: string): FootForm {
  return { work, shoe_make: '', shoe_size: '', modifications: '', pads: '', findings: '' };
}

type FootRow = {
  foot: string;
  work: string;
  shoe_make?: string | null;
  shoe_size?: string | null;
  pads?: string | null;
  modifications?: string | null;
  findings?: string | null;
};

/** What the form starts from: the visit being edited, or the horse's last visit. */
type Start = {
  mode: 'edit' | 'copy' | 'blank';
  horseName?: string;
  date?: string;
  nextDue?: string | null;
  workType?: string | null;
  ground?: string | null;
  notes?: string | null;
  shared?: boolean;
  appointmentId?: string | null;
  feet: FootRow[];
  flags: { id: string; flag_type: string }[];
  /** Photos still on this phone (editing a visit that hasn't uploaded). */
  localPhotos: PendingPhoto[];
  savedPhotos: number;
};

const VISIT_SELECT = 'id, visit_date, next_due_date, work_type, ground_conditions, notes, shared_with_owner, appointment_id, horses(name), visit_feet(*), visit_flags(id, flag_type), visit_photos(id)';

async function loadStart(horseId: string, userId: string, editId?: string): Promise<Start> {
  const pending = await listPending();
  if (editId) {
    const p = pending.find((i) => i.visit.id === editId);
    if (p) {
      return {
        mode: 'edit',
        date: p.visit.visit_date,
        nextDue: p.visit.next_due_date,
        workType: p.visit.work_type,
        ground: p.visit.ground_conditions,
        notes: p.visit.notes,
        shared: p.visit.shared_with_owner,
        appointmentId: p.visit.appointment_id,
        feet: p.feet,
        flags: p.flags,
        localPhotos: p.photos,
        savedPhotos: 0,
      };
    }
    const { data, error } = await supabase.from('visits').select(VISIT_SELECT).eq('id', editId).single();
    if (error) throw error;
    return {
      mode: 'edit',
      horseName: data.horses?.name,
      date: data.visit_date,
      nextDue: data.next_due_date,
      workType: data.work_type,
      ground: data.ground_conditions,
      notes: data.notes,
      shared: data.shared_with_owner,
      appointmentId: data.appointment_id,
      feet: data.visit_feet,
      flags: data.visit_flags,
      localPhotos: [],
      savedPhotos: data.visit_photos.length,
    };
  }

  // A new visit starts from this farrier's last one for the horse: same
  // work, same shoes, same modifications. Findings and problems start clean.
  const mine = pending
    .filter((i) => i.visit.horse_id === horseId)
    .sort((a, b) => b.visit.visit_date.localeCompare(a.visit.visit_date))[0];
  const { data: last } = await supabase
    .from('visits')
    .select(VISIT_SELECT)
    .eq('horse_id', horseId)
    .eq('provider_id', userId)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const useLocal = mine && (!last || mine.visit.visit_date >= last.visit_date);
  const from = useLocal
    ? { date: mine.visit.visit_date, workType: mine.visit.work_type, ground: mine.visit.ground_conditions, feet: mine.feet }
    : last
      ? { date: last.visit_date, workType: last.work_type, ground: last.ground_conditions, feet: last.visit_feet }
      : null;
  if (!from) return { mode: 'blank', feet: [], flags: [], localPhotos: [], savedPhotos: 0 };
  return {
    mode: 'copy',
    date: from.date,
    workType: from.workType,
    ground: from.ground,
    feet: from.feet.map((f) => ({ ...f, findings: null })),
    flags: [],
    localPhotos: [],
    savedPhotos: 0,
  };
}

function toForm(row: FootRow | undefined, fallbackWork: string): FootForm {
  if (!row) return blankFoot(fallbackWork);
  return {
    work: row.work,
    shoe_make: row.shoe_make ?? '',
    shoe_size: row.shoe_size ?? '',
    modifications: row.modifications ?? '',
    pads: row.pads ?? '',
    findings: row.findings ?? '',
  };
}

function dayOf(date: string) {
  return new Date(`${date}T00:00`);
}

/**
 * Farrier logs a visit for one horse. Everything is saved on the phone
 * first and uploads in the background, so this works with no signal.
 */
export default function NewVisit() {
  const params = useLocalSearchParams<{
    horseId: string;
    horseName?: string;
    interval?: string;
    appointmentId?: string;
    /** Edit this saved visit instead of logging a new one. */
    editId?: string;
  }>();
  const { session } = useAuth();
  const [start, setStart] = useState<Start | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadStart(params.horseId, session!.user.id, params.editId)
      .then(setStart)
      .catch((e) => {
        // No signal: start blank rather than block the farrier.
        if (params.editId) setLoadError(errorMessage(e));
        else setStart({ mode: 'blank', feet: [], flags: [], localPhotos: [], savedPhotos: 0 });
      });
  }, [params.horseId, params.editId, session]);

  if (loadError) return <Screen><ErrorText>{loadError}</ErrorText></Screen>;
  if (!start) return <Loading />;
  return <VisitForm params={params} start={start} userId={session!.user.id} />;
}

function VisitForm({
  params,
  start,
  userId,
}: {
  params: { horseId: string; horseName?: string; interval?: string; appointmentId?: string; editId?: string };
  start: Start;
  userId: string;
}) {
  const editing = start.mode === 'edit';
  const initialWork = start.workType ?? 'trim';

  const today = startOfDay(new Date());
  const [date, setDate] = useState(editing && start.date ? dayOf(start.date) : today);
  const [workType, setWorkType] = useState(initialWork);
  const [feet, setFeet] = useState<Record<Foot, FootForm>>(() => {
    const row = (foot: Foot) => toForm(start.feet.find((f) => f.foot === foot), footWorkFor(initialWork, foot));
    return { LF: row('LF'), RF: row('RF'), LH: row('LH'), RH: row('RH') };
  });
  const [openFoot, setOpenFoot] = useState<Foot | null>(null);
  const [flags, setFlags] = useState<string[]>(start.flags.map((f) => f.flag_type));
  const [ground, setGround] = useState<string | null>(start.ground ?? null);
  const [notes, setNotes] = useState(editing ? (start.notes ?? '') : '');
  const initialWeeks =
    editing && start.date && start.nextDue
      ? String(Math.round((dayOf(start.nextDue).getTime() - dayOf(start.date).getTime()) / (7 * 86_400_000)))
      : params.interval || '6';
  const [dueWeeks, setDueWeeks] = useState(initialWeeks);
  const [share, setShare] = useState(editing ? start.shared !== false : true);
  const [photos, setPhotos] = useState<PendingPhoto[]>(start.localPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextDue = addDays(date, Number(dueWeeks) * 7);

  function chooseWorkType(w: string) {
    setWorkType(w);
    setFeet((prev) => {
      const next = { ...prev };
      for (const { value } of FEET) next[value] = { ...prev[value], work: footWorkFor(w, value) };
      return next;
    });
  }

  function updateFoot(foot: Foot, patch: Partial<FootForm>) {
    setFeet((prev) => ({ ...prev, [foot]: { ...prev[foot], ...patch } }));
  }

  /** Copies one foot's shoe details to every other shod foot. */
  function copyShoes(from: Foot) {
    const src = feet[from];
    setFeet((prev) => {
      const next = { ...prev };
      for (const { value } of FEET) {
        if (value !== from && SHOD.includes(prev[value].work)) {
          next[value] = { ...prev[value], shoe_make: src.shoe_make, shoe_size: src.shoe_size, pads: src.pads };
        }
      }
      return next;
    });
  }

  async function addPhoto(photoLabel: 'before' | 'after') {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const result = perm.granted
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (result.canceled || !result.assets[0]) return;
      const id = Crypto.randomUUID();
      const localUri = await keepPhoto(result.assets[0].uri, id);
      setPhotos((p) => [...p, { id, localUri, label: photoLabel }]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const visitId = params.editId ?? Crypto.randomUUID();
      // Keep the ids of problems that were already recorded, so edits don't duplicate them.
      const flagId = (flag_type: string) => start.flags.find((f) => f.flag_type === flag_type)?.id ?? Crypto.randomUUID();
      const clean = (s: string) => s.trim() || null;
      await enqueueVisit({
        visit: {
          id: visitId,
          horse_id: params.horseId,
          provider_id: userId,
          appointment_id: params.appointmentId || start.appointmentId || null,
          visit_type: 'farrier',
          visit_date: toDateString(date),
          work_type: workType,
          notes: clean(notes),
          next_due_date: toDateString(nextDue),
          ground_conditions: ground,
          is_flagged: flags.length > 0,
          shared_with_owner: share,
        },
        feet: FEET.map(({ value }) => ({
          visit_id: visitId,
          foot: value,
          work: feet[value].work,
          shoe_make: SHOD.includes(feet[value].work) ? clean(feet[value].shoe_make) : null,
          shoe_size: SHOD.includes(feet[value].work) ? clean(feet[value].shoe_size) : null,
          pads: SHOD.includes(feet[value].work) ? clean(feet[value].pads) : null,
          modifications: clean(feet[value].modifications),
          findings: clean(feet[value].findings),
        })),
        flags: flags.map((flag_type) => ({ id: flagId(flag_type), flag_type, notes: null })),
        photos,
        savedAt: new Date().toISOString(),
        replaceFlags: editing,
      });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {editing ? <Stack.Screen options={{ title: 'Edit visit' }} /> : null}
      {params.horseName || start.horseName ? (
        <ThemedText type="subtitle">{params.horseName || start.horseName}</ThemedText>
      ) : null}
      {start.mode === 'copy' && start.date ? (
        <ThemedText type="small" themeColor="textSecondary">
          Filled in from the last visit on {formatDate(start.date)}. Change anything that&apos;s different.
        </ThemedText>
      ) : null}
      <DateStepper label="Visit date" value={date} onChange={setDate} format={formatDay} />
      <Segmented label="Work done" options={WORK_TYPES} value={workType} onChange={chooseWorkType} />

      <SectionTitle>Each foot</SectionTitle>
      {FEET.map(({ value: foot, label: footLabel }) => {
        const f = feet[foot];
        const shod = SHOD.includes(f.work);
        const open = openFoot === foot;
        const summary = [
          FOOT_WORK.find((w) => w.value === f.work)?.label,
          shod && f.shoe_size ? `size ${f.shoe_size}` : null,
          f.findings || null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Card key={foot} onPress={open ? undefined : () => setOpenFoot(foot)}>
            <ThemedText style={{ fontWeight: 600 }}>{footLabel}</ThemedText>
            {!open ? (
              <ThemedText type="small" themeColor="textSecondary">
                {summary} · Tap to edit
              </ThemedText>
            ) : (
              <View style={styles.footForm}>
                <Segmented options={FOOT_WORK} value={f.work} onChange={(work) => updateFoot(foot, { work })} />
                {shod ? (
                  <>
                    <Field
                      label="Shoe make / model"
                      value={f.shoe_make}
                      onChangeText={(shoe_make) => updateFoot(foot, { shoe_make })}
                    />
                    <Field
                      label="Size"
                      value={f.shoe_size}
                      onChangeText={(shoe_size) => updateFoot(foot, { shoe_size })}
                    />
                    <Field label="Pads" value={f.pads} onChangeText={(pads) => updateFoot(foot, { pads })} />
                    <Button title="Copy shoe details to other shod feet" variant="secondary" onPress={() => copyShoes(foot)} />
                  </>
                ) : null}
                <Field
                  label="Modifications"
                  value={f.modifications}
                  onChangeText={(modifications) => updateFoot(foot, { modifications })}
                  placeholder="Clips, rolled toe, wedge"
                />
                <Field
                  label="Findings"
                  value={f.findings}
                  onChangeText={(findings) => updateFoot(foot, { findings })}
                  placeholder="Bruise, flare, crack"
                />
                <Button title="Done" variant="secondary" onPress={() => setOpenFoot(null)} />
              </View>
            )}
          </Card>
        );
      })}

      <MultiSelect label="Problems" options={FLAG_TYPES} values={flags} onChange={setFlags} />
      <Segmented label="Ground" options={GROUND} value={ground} onChange={setGround} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

      <SectionTitle>Photos</SectionTitle>
      {start.savedPhotos ? (
        <ThemedText type="small" themeColor="textSecondary">
          {start.savedPhotos} {start.savedPhotos === 1 ? 'photo' : 'photos'} already saved. Add more below.
        </ThemedText>
      ) : null}
      <View style={styles.photos}>
        {photos.map((p) => (
          <Image key={p.id} source={{ uri: p.localUri }} style={styles.photo} contentFit="cover" />
        ))}
      </View>
      <View style={styles.photoButtons}>
        <View style={{ flex: 1 }}>
          <Button title="Before photo" variant="secondary" onPress={() => addPhoto('before')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="After photo" variant="secondary" onPress={() => addPhoto('after')} />
        </View>
      </View>

      <Segmented label="Next due in" options={NEXT_DUE_WEEKS} value={dueWeeks} onChange={setDueWeeks} />
      <ThemedText themeColor="textSecondary">Next due {formatDay(nextDue)}</ThemedText>

      <View style={styles.share}>
        <ThemedText style={{ flex: 1 }}>Share this visit with the owner</ThemedText>
        <Switch value={share} onValueChange={setShare} />
      </View>

      <ErrorText>{error}</ErrorText>
      <Button title={editing ? 'Save changes' : 'Save visit'} onPress={save} loading={busy} />
      <ThemedText type="small" themeColor="textSecondary">
        Saved on your phone right away, and uploaded when you have signal.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footForm: { gap: Spacing.three, marginTop: Spacing.two },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photo: { width: 96, height: 96, borderRadius: 8 },
  photoButtons: { flexDirection: 'row', gap: Spacing.two },
  share: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
