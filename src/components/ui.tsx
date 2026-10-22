import type { ReactNode } from 'react';
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

/** A row of mutually exclusive options, e.g. US / Canada. */
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
  segment: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.one },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.two },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
});
