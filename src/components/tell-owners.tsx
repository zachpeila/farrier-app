import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { buildTexts, emailClients, openText, type MessageKind, type Target } from '@/lib/client-messages';
import { errorMessage } from '@/lib/supabase';

const TITLES: Record<MessageKind, string> = {
  booked: 'Let the owners know',
  changed: 'Tell the owners about the new time',
  cancelled: 'Tell the owners it is cancelled',
  invoice: 'Send it to the client',
  late: 'Tell the owners you are running late',
};

/**
 * Text (from the farrier's phone) or email each owner about a visit or an
 * invoice. Works for owners who never installed the app: their message has
 * a link they can open in any browser.
 */
export function TellOwners({
  kind,
  target,
  minutesLate,
  title,
}: {
  kind: MessageKind;
  target: Target;
  minutesLate?: number;
  title?: string;
}) {
  const { profile } = useAuth();
  const from = profile?.business_name || profile?.full_name || 'your farrier';
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'text' | 'email' | null>(null);

  async function text() {
    setBusy('text');
    setError(null);
    try {
      const recipients = await buildTexts(kind, target, from, minutesLate);
      const noPhone = recipients.filter((r) => !r.phone).map((r) => r.name);
      for (const r of recipients) if (r.phone) await openText(r.phone, r.message);
      setStatus(
        recipients.length === 0
          ? 'No owners on file for these horses.'
          : noPhone.length
            ? `No mobile number for ${noPhone.join(', ')}. Add one on the client, or email instead.`
            : `Text ready for ${recipients.map((r) => r.name).join(', ')}.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function email() {
    setBusy('email');
    setError(null);
    try {
      const res = await emailClients(kind, target, minutesLate);
      if (!res.emailEnabled) {
        setStatus('Email is not switched on yet. Text the owners instead.');
        return;
      }
      setStatus(
        [
          res.emailed.length ? `Emailed ${res.emailed.join(', ')}.` : null,
          res.noEmail.length ? `No email address for ${res.noEmail.join(', ')}.` : null,
        ]
          .filter(Boolean)
          .join(' ') || 'Nobody to email.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <ThemedText style={{ fontWeight: 600 }}>{title ?? TITLES[kind]}</ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
        <View style={{ flex: 1 }}>
          <Button title="Text" onPress={text} loading={busy === 'text'} disabled={!!busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Email" variant="secondary" onPress={email} loading={busy === 'email'} disabled={!!busy} />
        </View>
      </View>
      {status ? (
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
