import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { PRIVACY, TERMS, UPDATED } from '@/lib/legal';

/** Privacy policy or terms of use. Open to everyone, signed in or not. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = doc === 'terms' ? TERMS : PRIVACY;
  return (
    <Screen>
      <Stack.Screen options={{ title: content.title }} />
      <ThemedText type="small" themeColor="textSecondary">
        Last updated {UPDATED}
      </ThemedText>
      {content.sections.map((s) => (
        <View key={s.heading} style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold">{s.heading}</ThemedText>
          {s.body.map((p) => (
            <ThemedText key={p}>{p}</ThemedText>
          ))}
        </View>
      ))}
    </Screen>
  );
}
