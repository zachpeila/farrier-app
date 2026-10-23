import { router } from 'expo-router';

import { ProfileForm } from '@/components/profile-form';
import { ThemedText } from '@/components/themed-text';
import { Button, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Account() {
  const { session, profile, mode, setMode, signOut } = useAuth();
  if (!mode) return null;

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">Signed in as {session?.user.email}</ThemedText>
      <SectionTitle>Profile</SectionTitle>
      <ProfileForm key={`${mode}-${profile?.updated_at}`} mode={mode} submitLabel="Save" />

      {mode === 'farrier' ? (
        <>
          <SectionTitle>Business</SectionTitle>
          <Button title="Prices and taxes" variant="secondary" onPress={() => router.push('/settings/billing')} />
          <Button title="Your barns" variant="secondary" onPress={() => router.push('/barns')} />
        </>
      ) : null}

      <SectionTitle>Invites</SectionTitle>
      <Button title="Enter an invite code" variant="secondary" onPress={() => router.push('/invite')} />

      <SectionTitle>App mode</SectionTitle>
      <ThemedText type="small" themeColor="textSecondary">
        {mode === 'farrier'
          ? 'You are using the farrier side. Switch if you also own horses that another farrier shoes.'
          : 'You are using the owner side. Switch if you are a farrier.'}
      </ThemedText>
      <Button
        title={mode === 'farrier' ? 'Switch to owner' : 'Switch to farrier'}
        variant="secondary"
        onPress={() => setMode(mode === 'farrier' ? 'owner' : 'farrier')}
      />

      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}
