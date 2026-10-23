import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  DateStepper,
  ErrorText,
  Field,
  MultiSelect,
  Screen,
  SectionTitle,
  Segmented,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { enqueueVisit, keepPhoto, type PendingPhoto } from '@/lib/outbox';
import { addDays, formatDay, startOfDay, toDateString } from '@/lib/schedule';
import { errorMessage } from '@/lib/supabase';
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
  }>();
  const { session } = useAuth();

  const today = startOfDay(new Date());
  const [date, setDate] = useState(today);
  const [workType, setWorkType] = useState('trim');
  const [feet, setFeet] = useState<Record<Foot, FootForm>>(() => ({
    LF: blankFoot('trim'),
    RF: blankFoot('trim'),
    LH: blankFoot('trim'),
    RH: blankFoot('trim'),
  }));
  const [openFoot, setOpenFoot] = useState<Foot | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [ground, setGround] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [dueWeeks, setDueWeeks] = useState(params.interval || '6');
  const [share, setShare] = useState(true);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
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
      const visitId = Crypto.randomUUID();
      const clean = (s: string) => s.trim() || null;
      await enqueueVisit({
        visit: {
          id: visitId,
          horse_id: params.horseId,
          provider_id: session!.user.id,
          appointment_id: params.appointmentId || null,
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
        flags: flags.map((flag_type) => ({ id: Crypto.randomUUID(), flag_type, notes: null })),
        photos,
        savedAt: new Date().toISOString(),
      });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {params.horseName ? <ThemedText type="subtitle">{params.horseName}</ThemedText> : null}
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
      <Button title="Save visit" onPress={save} loading={busy} />
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
