import { Alert, AlertButton, Platform } from 'react-native';

/**
 * React Native Web's Alert.alert does nothing, which silently drops every
 * confirmation and error message. This gives it the browser's dialogs.
 */
export function installWebAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    const cancel = (buttons ?? []).find((b) => b.style === 'cancel');

    if (cancel && actions.length > 0) {
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel.onPress?.();
      return;
    }

    window.alert(text);
    actions[0]?.onPress?.();
  };
}
