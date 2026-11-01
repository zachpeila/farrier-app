import { router } from 'expo-router';
import { useState } from 'react';

import { ProfileForm } from '@/components/profile-form';
import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { deleteMyAccount } from '@/lib/payments';
import { errorMessage } from '@/lib/supabase';

export default function Account() {
  const { session, profile, mode, setMode, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!mode) return null;

  async function confirmSignOut() {
    const ok = await confirmAction({
      title: 'Sign out?',
      message: 'Visits saved on this phone and not yet uploaded will upload next time you sign in.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
    });
    if (ok) signOut();
  }

  async function deleteAccount() {
    const ok = await confirmAction({
      title: 'Delete your account?',
      message:
        mode === 'farrier'
          ? 'This deletes your clients, barns, visit records, photos, invoices and payments for good. Owners keep their own horses. This cannot be undone.'
          : 'This deletes your account and removes you from your horses. Your farrier keeps their records of the horses. This cannot be undone.',
      confirmLabel: 'Delete everything',
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  }

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

      <SectionTitle>About</SectionTitle>
      <Button title="Privacy policy" variant="secondary" onPress={() => router.push('/legal/privacy')} />
      <Button title="Terms of use" variant="secondary" onPress={() => router.push('/legal/terms')} />

      <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
      <ErrorText>{error}</ErrorText>
      <Button title="Delete my account" variant="secondary" loading={deleting} onPress={deleteAccount} />
    </Screen>
  );
}
