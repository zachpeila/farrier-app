import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ErrorText, Loading, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { formatMoney, INVOICE_STATUS_LABELS } from '@/lib/money';
import { fetchInvoices, type InvoiceListItem } from '@/lib/queries';

type Filter = 'open' | 'draft' | 'paid' | 'all';

const MATCHES: Record<Filter, (i: InvoiceListItem) => boolean> = {
  open: (i) => i.status === 'sent' || i.status === 'partially_paid',
  draft: (i) => i.status === 'draft',
  paid: (i) => i.status === 'paid',
  all: () => true,
};

export default function Invoices() {
  const { session, mode } = useAuth();
  const userId = session!.user.id;
  const farrier = mode === 'farrier';
  const theme = useTheme();
  const { data, error, loading } = useQuery(fetchInvoices, userId);
  const [filter, setFilter] = useState<Filter>('open');

  if (loading && !data) return <Loading />;

  // In farrier mode, only invoices you sent; in owner mode, ones sent to you.
  const mine = (data ?? []).filter((i) => (farrier ? i.provider_id === userId : i.provider_id !== userId));
  const shown = mine.filter(MATCHES[filter]);
  const owing = new Map<string, number>();
  for (const i of mine.filter(MATCHES.open)) {
    owing.set(i.currency, (owing.get(i.currency) ?? 0) + (i.total_cents ?? 0) - i.amount_paid_cents);
  }

  return (
    <Screen>
      {farrier ? <Button title="New invoice" onPress={() => router.push('/invoice/new')} /> : null}
      <ErrorText>{error}</ErrorText>
      {owing.size ? (
        <Card>
          <ThemedText style={{ fontWeight: 600 }}>
            {[...owing].map(([cur, cents]) => formatMoney(cents, cur)).join(' + ')} {farrier ? 'owed to you' : 'to pay'}
          </ThemedText>
        </Card>
      ) : null}
      <Segmented
        options={[
          { value: 'open', label: 'Unpaid' },
          ...(farrier ? [{ value: 'draft' as const, label: 'Drafts' }] : []),
          { value: 'paid', label: 'Paid' },
          { value: 'all', label: 'All' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {data && shown.length === 0 ? (
        <EmptyState
          title="No invoices here"
          body={farrier ? 'Create one from a visit, a client, or the button above.' : undefined}
        />
      ) : null}
      <View style={{ gap: 8 }}>
        {shown.map((i) => (
          <Card key={i.id} onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: i.id } })}>
            <View style={styles.row}>
              <ThemedText style={{ fontWeight: 600, flexShrink: 1 }}>
                #{i.invoice_number} ·{' '}
                {farrier ? i.clients?.full_name : i.profiles?.business_name || i.profiles?.full_name}
              </ThemedText>
              <ThemedText>{formatMoney(i.total_cents, i.currency)}</ThemedText>
            </View>
            <ThemedText
              type="small"
              style={{ color: i.status === 'paid' ? theme.success : i.status === 'void' ? theme.textSecondary : theme.warning }}>
              {INVOICE_STATUS_LABELS[i.status]}
              {i.due_date && MATCHES.open(i) ? ` · due ${formatDate(i.due_date)}` : ''}
            </ThemedText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
});
