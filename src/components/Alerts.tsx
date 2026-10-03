/**
 * Branded popups — the MAUI AlertService and its three modal pages
 * (Views/Popups/AppAlertPage, AppPromptPage, AppActionSheetPage), with the
 * same promise-based API:
 *
 *   await alerts.show(title, message, buttonText)
 *   await alerts.confirm(title, message, acceptText, cancelText) -> boolean
 *   await alerts.prompt(title, message, { initialValue, keyboard }) -> string | null
 *   await alerts.actionSheet(title, cancelText, ...options) -> string | null
 *
 * Callable from anywhere (screens, handlers) — <AlertHost/> is mounted once
 * at the root and renders whichever popup is at the front of the queue.
 */
import React, { useEffect, useState } from 'react';
import { Animated, Easing, KeyboardTypeOptions, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './AppText';
import { useApp } from '../state/AppState';

type Request =
  | { kind: 'alert'; title: string; message: string; buttons: string[]; resolve: (index: number) => void }
  | { kind: 'prompt'; title: string; message: string; initialValue: string; keyboard?: KeyboardTypeOptions; accept: string; cancel: string; resolve: (value: string | null) => void }
  | { kind: 'sheet'; title: string; cancel: string; options: string[]; resolve: (value: string | null) => void };

// Module-level, alongside the queue: <AlertHost/> is mounted exactly once.
const queue: Request[] = [];
let notify: (() => void) | null = null;
let showing: Request | null = null;
let closing = false;

function enqueue(request: Request) {
  queue.push(request);
  notify?.();
}

export const alerts = {
  show(title: string, message: string, buttonText = 'OK'): Promise<void> {
    return new Promise(resolve => enqueue({ kind: 'alert', title, message, buttons: [buttonText], resolve: () => resolve() }));
  },
  confirm(title: string, message: string, acceptText: string, cancelText: string): Promise<boolean> {
    return new Promise(resolve => enqueue({ kind: 'alert', title, message, buttons: [acceptText, cancelText], resolve: i => resolve(i === 0) }));
  },
  prompt(
    title: string,
    message: string,
    options: { initialValue?: string; keyboard?: KeyboardTypeOptions; acceptText?: string; cancelText?: string } = {}
  ): Promise<string | null> {
    return new Promise(resolve =>
      enqueue({
        kind: 'prompt',
        title,
        message,
        initialValue: options.initialValue ?? '',
        keyboard: options.keyboard,
        accept: options.acceptText ?? 'OK',
        cancel: options.cancelText ?? 'Cancel',
        resolve,
      })
    );
  },
  actionSheet(title: string, cancelText: string, ...options: string[]): Promise<string | null> {
    return new Promise(resolve => enqueue({ kind: 'sheet', title, cancel: cancelText, options, resolve }));
  },
};

function resetClosing() {
  closing = false;
}

/** Animates the current popup out, then settles its promise and lets the next one in. */
function dismiss(progress: Animated.Value, clear: () => void, settle: () => void) {
  if (closing) return;
  closing = true;
  Animated.timing(progress, { toValue: 0, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(() => {
    showing = null;
    clear();
    settle();
    setTimeout(() => notify?.(), 0);
  });
}

export function AlertHost() {
  const { colors } = useApp();
  const [current, setCurrent] = useState<Request | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const pump = () => {
      if (showing || queue.length === 0) return;
      const next = queue.shift()!;
      showing = next;
      if (next.kind === 'prompt') setPromptValue(next.initialValue);
      setCurrent(next);
    };
    notify = pump;
    pump();
    return () => {
      notify = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    resetClosing();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: current.kind === 'sheet' ? 200 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [current, progress]);

  const close = (settle: () => void) => dismiss(progress, () => setCurrent(null), settle);

  if (!current) return null;

  const primaryButton = (label: string, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
  const outlineButton = (label: string, onPress: () => void, textColor = colors.primary, bold = true) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.outline, { borderColor: colors.primary }, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color: textColor, fontWeight: bold ? '700' : '400' }]}>{label}</Text>
    </Pressable>
  );

  const cardAnim = {
    opacity: progress,
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
  };
  const sheetAnim = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
  };

  // Hardware back acts like the last (typically "Cancel") button.
  const onBack = () => {
    if (current.kind === 'alert') close(() => current.resolve(current.buttons.length - 1));
    else close(() => current.resolve(null));
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onBack} statusBarTranslucent>
      <View style={[styles.backdrop, current.kind === 'sheet' && styles.backdropSheet]}>
        {current.kind === 'sheet' ? (
          <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBg }, sheetAnim]}>
            <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>{current.title}</Text>
            <View style={styles.stack8}>
              {current.options.map(option =>
                outlineButton(option, () => close(() => current.resolve(option)), colors.text, false)
              )}
            </View>
            <View style={styles.sheetCancel}>{outlineButton(current.cancel, () => close(() => current.resolve(null)))}</View>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.card, { backgroundColor: colors.cardBg }, cardAnim]}>
            <Text style={[styles.title, { color: colors.primary }]}>{current.title}</Text>
            <Text style={[styles.message, { color: colors.text }]}>{current.message}</Text>
            {current.kind === 'prompt' && (
              <View style={[styles.inputBorder, { borderColor: colors.primary }]}>
                <TextInput
                  value={promptValue}
                  onChangeText={setPromptValue}
                  autoFocus
                  keyboardType={current.keyboard}
                  style={[styles.input, { color: colors.text }]}
                  onSubmitEditing={() => close(() => current.resolve(promptValue))}
                />
              </View>
            )}
            <View style={styles.buttons}>
              {current.kind === 'alert'
                ? current.buttons.map((label, index) =>
                    index === 0
                      ? primaryButton(label, () => close(() => current.resolve(index)))
                      : outlineButton(label, () => close(() => current.resolve(index)))
                  )
                : [
                    primaryButton(current.accept, () => close(() => current.resolve(promptValue))),
                    outlineButton(current.cancel, () => close(() => current.resolve(null))),
                  ]}
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  backdropSheet: { justifyContent: 'flex-end', alignItems: 'stretch' },
  card: {
    width: '100%',
    maxWidth: 360,
    marginHorizontal: 34,
    borderRadius: 20,
    paddingHorizontal: 26,
    paddingVertical: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  title: { fontSize: 19, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 20 },
  inputBorder: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  input: { fontSize: 15, minHeight: 40 },
  buttons: { gap: 10, marginTop: 6 },
  button: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  outline: { borderWidth: 1, backgroundColor: 'transparent' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stack8: { gap: 8 },
  sheetCancel: { marginTop: 6 },
});
