import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, MultiSelect, Screen, SectionTitle, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { radiusOptions, SERVICES } from '@/lib/finder';
import { errorMessage, supabase } from '@/lib/supabase';

/**
 * The farrier's listing in "Find a farrier". Off until they turn it on;
 * owners only see the farrier's name, area, services and (if they choose)
 * starting price, and send a request the farrier can accept or decline.
 */
export default function ListingSettings() {
  const { session, profile, refreshProfile } = useAuth();
  const unit = profile?.distance_unit ?? 'mi';
  const [listed, setListed] = useState(profile?.listed ?? false);
  const [accepting, setAccepting] = useState(profile?.accepting_clients ?? true);
  const [base, setBase] = useState(
    profile?.base_latitude != null && profile.base_longitude != null
      ? { latitude: profile.base_latitude, longitude: profile.base_longitude }
      : null,
  );
  const [place, setPlace] = useState(profile?.service_area ?? '');
  const options = radiusOptions(unit);
  const [radius, setRadius] = useState(() => {
    // Snap a saved radius to the nearest choice in this unit.
    const km = profile?.travel_km ?? 60;
    return options.reduce((best, o) => (Math.abs(Number(o.value) - km) < Math.abs(Number(best.value) - km) ? o : best)).value;
  });
  const [services, setServices] = useState<string[]>(profile?.services ?? []);
  const [years, setYears] = useState(profile?.years_experience != null ? String(profile.years_experience) : '');
  const [certs, setCerts] = useState(profile?.certifications ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [showPrices, setShowPrices] = useState(profile?.show_prices ?? false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function locate(source: 'here' | 'place') {
    setLocating(true);
    setError(null);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error('Location permission is needed to set your home base.');
      if (source === 'here') {
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setBase({ latitude: coords.latitude, longitude: coords.longitude });
      } else {
        const [match] = await Location.geocodeAsync(place.trim());
        if (!match) throw new Error("Couldn't find that place. Try a town name, or use where you are now.");
        setBase({ latitude: match.latitude, longitude: match.longitude });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const y = years.trim() ? Number(years.trim()) : null;
    const { error } = await supabase
      .from('profiles')
      .update({
        listed: listed && !!base,
        accepting_clients: accepting,
        // Rounded to about 1 km so a farrier's home address isn't exposed.
        base_latitude: base ? Math.round(base.latitude * 100) / 100 : null,
        base_longitude: base ? Math.round(base.longitude * 100) / 100 : null,
        travel_km: Number(radius),
        service_area: place.trim() || null,
        services,
        years_experience: y != null && Number.isFinite(y) ? y : null,
        certifications: certs.trim() || null,
        bio: bio.trim() || null,
        show_prices: showPrices,
      })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else {
      await refreshProfile();
      setSaved(true);
    }
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Horse owners near you can find you and ask to become clients. You decide who to take on.
      </ThemedText>
      <View style={styles.switchRow}>
        <ThemedText style={{ flex: 1, fontWeight: 600 }}>Show me in Find a farrier</ThemedText>
        <Switch value={listed} onValueChange={setListed} />
      </View>
      <View style={styles.switchRow}>
        <ThemedText style={{ flex: 1 }}>Taking new clients</ThemedText>
        <Switch value={accepting} onValueChange={setAccepting} />
      </View>
      {!accepting ? (
        <ThemedText type="small" themeColor="textSecondary">
          You still show up, marked as not taking new clients, so owners can look elsewhere.
        </ThemedText>
      ) : null}

      <SectionTitle>Where you work</SectionTitle>
      <Field label="Home base (town or area)" value={place} onChangeText={setPlace} placeholder="e.g. Longmont, CO" />
      <View style={styles.buttons}>
        <View style={{ flex: 1 }}>
          <Button title="Find this place" variant="secondary" loading={locating} disabled={!place.trim()} onPress={() => locate('place')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Use where I am" variant="secondary" loading={locating} onPress={() => locate('here')} />
        </View>
      </View>
      <ThemedText type="small" themeColor={base ? 'success' : 'textSecondary'}>
        {base ? 'Home base set. Owners see your town, never an exact address.' : 'Set a home base so owners near you can find you.'}
      </ThemedText>
      <Segmented
        label="How far you travel"
        options={options}
        value={radius}
        onChange={setRadius}
      />

      <SectionTitle>What owners see</SectionTitle>
      <MultiSelect label="Services" options={SERVICES} values={services} onChange={setServices} />
      <Field label="Years shoeing" value={years} onChangeText={setYears} keyboardType="number-pad" maxLength={2} />
      <Field label="Certifications" value={certs} onChangeText={setCerts} placeholder="e.g. AFA CF, BWFA" />
      <Field label="About you" value={bio} onChangeText={setBio} multiline placeholder="A sentence or two about how you work" />
      <View style={styles.switchRow}>
        <ThemedText style={{ flex: 1 }}>Show my starting price</ThemedText>
        <Switch value={showPrices} onValueChange={setShowPrices} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Shows &ldquo;from&rdquo; your lowest price in Prices and taxes. Off means owners see prices only after you accept them.
      </ThemedText>

      {listed && !base ? (
        <Card>
          <ThemedText type="small">Set a home base before turning on your listing.</ThemedText>
        </Card>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button title="Save listing" onPress={save} loading={busy} />
      {saved ? (
        <ThemedText type="small" themeColor="success">
          Saved. {listed && base ? 'Owners near you can find you now.' : 'You are not listed.'}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
});
