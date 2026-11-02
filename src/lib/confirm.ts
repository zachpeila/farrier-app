import { Alert, Platform } from 'react-native';

/**
 * Asks "are you sure?" before something hard to undo, like cancelling a
 * visit or voiding an invoice. Resolves true only if the person agrees.
 */
export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep it',
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
