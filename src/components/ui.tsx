import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  const inner = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: theme.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const theme = useTheme();
  const bg =
    variant === 'primary' ? theme.accent : variant === 'danger' ? theme.danger : theme.backgroundElement;
  const fg = variant === 'secondary' ? theme.text : theme.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <ThemedText style={{ color: fg, fontWeight: 600 }}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...input}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          input.multiline && { minHeight: 88, textAlignVertical: 'top' },
        ]}
      />
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Above this many options, Segmented shows a dropdown list instead of a wall of buttons. */
const MAX_BUTTONS = 8;

/**
 * Pick one of several options, e.g. US / Canada. A short list shows as
 * buttons; a long one (barns, arrival times) as a dropdown with search.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  if (options.length > MAX_BUTTONS) {
    return <Dropdown label={label} options={options} value={value} onChange={onChange} />;
  }
  return <Buttons label={label} options={options} value={value} onChange={onChange} />;
}

function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const current = options.find((o) => o.value === value);
  const q = filter.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Choose'}: ${current?.label ?? 'none'}`}
        onPress={() => setOpen(!open)}
        style={[styles.input, styles.dropdown, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText style={{ flex: 1 }} themeColor={current ? 'text' : 'textSecondary'}>
          {current?.label ?? 'Choose'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{open ? '▴' : '▾'}</ThemedText>
      </Pressable>
      {open ? (
        <View style={[styles.dropdownList, { borderColor: theme.border }]}>
          {options.length > 12 ? (
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Type to filter"
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
            />
          ) : null}
          <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {shown.map((o) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                    setFilter('');
                  }}
                  style={({ pressed }) => [styles.dropdownItem, (pressed || selected) && { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={selected ? { fontWeight: 600, color: theme.accent } : undefined}>
                    {selected ? '✓ ' : ''}
                    {o.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function Buttons<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <View style={styles.segmented}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[
                styles.segment,
                {
                  backgroundColor: selected ? theme.accent : theme.backgroundElement,
                  borderColor: selected ? theme.accent : theme.border,
                },
              ]}>
              <ThemedText type="small" style={{ color: selected ? theme.accentText : theme.text }}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Like Segmented, but any number of options can be on. */
export function MultiSelect({
  label,
  options,
  values,
  onChange,
}: {
  label?: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <View style={styles.segmented}>
        {options.map((o) => {
          const selected = values.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(selected ? values.filter((v) => v !== o.value) : [...values, o.value])}
              style={[
                styles.segment,
                {
                  backgroundColor: selected ? theme.accent : theme.backgroundElement,
                  borderColor: selected ? theme.accent : theme.border,
                },
              ]}>
              <ThemedText type="small" style={{ color: selected ? theme.accentText : theme.text }}>
                {selected ? '✓ ' : ''}
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Pick a day by stepping back and forward; never goes before `min`. */
export function DateStepper({
  label,
  value,
  onChange,
  min,
  format,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  min?: Date;
  format: (d: Date) => string;
}) {
  const theme = useTheme();
  const step = (days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    if (min && next < min) return;
    onChange(next);
  };
  const atMin = !!min && value.getTime() - 86_400_000 < min.getTime();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={[styles.stepper, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          disabled={atMin}
          onPress={() => step(-1)}
          style={[styles.stepButton, atMin && { opacity: 0.3 }]}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <ThemedText style={{ fontWeight: 600 }}>{format(value)}</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          onPress={() => step(1)}
          style={styles.stepButton}>
          <ThemedText type="subtitle">›</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const theme = useTheme();
  const cardStyle = [styles.card, { backgroundColor: theme.backgroundElement }, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <ThemedText style={{ fontWeight: 600, textAlign: 'center' }}>{title}</ThemedText>
      {body ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {body}
        </ThemedText>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <ThemedText type="small" style={{ color: theme.danger }}>
      {children}
    </ThemedText>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dropdownList: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: Spacing.one, gap: Spacing.one },
  dropdownItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: 8 },
  segment: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  stepper: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: { width: 56, height: 48, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.one },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.two },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
});
