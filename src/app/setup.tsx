import { useState } from 'react';

import { ProfileForm } from '@/components/profile-form';
import { ThemedText } from '@/components/themed-text';
import { Screen, Segmented } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { AppMode } from '@/lib/types';

export default function Setup() {
  const { setMode } = useAuth();
  const [mode, setLocalMode] = useState<AppMode | null>(null);

  return (
    <Screen>
      <ThemedText type="subtitle">Let&apos;s get you set up</ThemedText>
      <Segmented
        label="I am a"
        options={[
          { value: 'farrier', label: 'Farrier' },
          { value: 'owner', label: 'Horse owner' },
        ]}
        value={mode}
        onChange={setLocalMode}
      />
      {mode ? (
        // Saving the mode last is what moves the app past setup.
        <ProfileForm key={mode} mode={mode} submitLabel="Continue" onSaved={() => setMode(mode)} />
      ) : null}
    </Screen>
  );
}
