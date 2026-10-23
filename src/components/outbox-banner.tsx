import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { syncOutbox, usePendingVisits } from '@/lib/outbox';

/** Shows how many visits are still on the phone; tap to try uploading now. */
export function OutboxBanner() {
  const { items, error } = usePendingVisits();
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <Card onPress={() => syncOutbox()}>
      <ThemedText type="smallBold" style={{ color: theme.warning }}>
        {items.length} {items.length === 1 ? 'visit' : 'visits'} saved on this phone, waiting to upload
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {error ? `Last try: ${error}. ` : ''}Tap to try now.
      </ThemedText>
    </Card>
  );
}
