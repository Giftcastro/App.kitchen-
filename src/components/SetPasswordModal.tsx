import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface SetPasswordModalProps {
  visible: boolean;
  email: string;
  initialPhone?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSavePassword: (password: string, fullName: string, phone: string) => void;
}

export const SetPasswordModal: React.FC<SetPasswordModalProps> = ({
  visible,
  email,
  initialPhone = '',
  isLoading = false,
  errorMessage,
  onClose,
  onSavePassword,
}) => {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>(initialPhone);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!visible) return null;

  const handleSubmit = () => {
    setLocalError(null);

    if (!phone || phone.trim().length < 8) {
      setLocalError('Please enter a valid corporate contact phone number.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match. Please re-enter.');
      return;
    }

    onSavePassword(password, fullName.trim(), phone.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
          <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
                <Ionicons name="key" size={24} color={theme.primary} />
              </View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Welcome to Kitchen Co.</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Set your password to activate your verified account for {email || 'your corporate email'}.
              </Text>
            </View>

            {/* Error Banner */}
            {(localError || errorMessage) && (
              <View style={[styles.errorCard, { backgroundColor: theme.errorSurface, borderColor: theme.errorBorder }]}>
                <Ionicons name="alert-circle" size={18} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{localError || errorMessage}</Text>
              </View>
            )}

            {/* Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <View style={[styles.inputField, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.textPrimary }]}
                  placeholder="e.g. Alex Van Der Berg"
                  placeholderTextColor={theme.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Phone Number Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Corporate Contact Phone Number</Text>
              <View style={[styles.inputField, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="call-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.textPrimary }]}
                  placeholder="+27 82 123 4567"
                  placeholderTextColor={theme.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>New Password</Text>
              <View style={[styles.inputField, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.textPrimary }]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={theme.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Confirm Password</Text>
              <View style={[styles.inputField, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.textPrimary }]}
                  placeholder="Re-enter password"
                  placeholderTextColor={theme.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* CTA Action */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isLoading}
              onPress={handleSubmit}
              style={[styles.saveBtn, { backgroundColor: theme.primary }, isLoading && styles.saveBtnDisabled]}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.textInverse} />
              ) : (
                <Text style={[styles.saveBtnText, { color: theme.textInverse }]}>Save & Continue to Menu</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    borderTopWidth: 1,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scroll: {
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
