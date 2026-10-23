import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { centsToInput, formatMoney, parseMoney } from '@/lib/money';

export type DraftLine = {
  key: string;
  description: string;
  quantity: string;
  price: string;
  taxable: boolean;
  horse_id: string | null;
  visit_id: string | null;
};

export function draftLine(
  description: string,
  cents: number,
  taxable = true,
  extra: Partial<Pick<DraftLine, 'horse_id' | 'visit_id'>> = {},
): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    description,
    quantity: '1',
    price: centsToInput(cents),
    taxable,
    horse_id: extra.horse_id ?? null,
    visit_id: extra.visit_id ?? null,
  };
}

export function lineCents(l: DraftLine): number {
  return (parseMoney(l.price) ?? 0) * Math.max(1, Math.round(Number(l.quantity) || 1));
}

/** Editable invoice line: description, quantity, unit price, taxable. */
export function LineEditor({
  line,
  currency,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  currency: string;
  onChange: (l: DraftLine) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <Field label="Description" value={line.description} onChangeText={(description) => onChange({ ...line, description })} />
      <View style={styles.row}>
        <View style={{ width: 80 }}>
          <Field
            label="Qty"
            value={line.quantity}
            onChangeText={(quantity) => onChange({ ...line, quantity })}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={`Price (${currency.toUpperCase()})`}
            value={line.price}
            onChangeText={(price) => onChange({ ...line, price })}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <View style={styles.row}>
        <ThemedText type="small">Taxable</ThemedText>
        <Switch value={line.taxable} onValueChange={(taxable) => onChange({ ...line, taxable })} />
        <View style={{ flex: 1 }} />
        <ThemedText style={{ fontWeight: 600 }}>{formatMoney(lineCents(line), currency)}</ThemedText>
      </View>
      <ThemedText type="smallBold" themeColor="danger" onPress={onRemove} accessibilityRole="button">
        Remove line
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
});
