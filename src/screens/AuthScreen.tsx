import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { BrandLogo } from '../components/BrandLogo';
import { INITIAL_CORPORATE_ACCOUNTS } from '../data/mockData';
import { CorporateAccount } from '../types';
import {
  generateStrongPassword,
  OTP_LENGTH,
  copyToClipboard,
  getAuthEndpointPath,
  parseAuthRouteFromPath,
  syncBrowserHistoryPath,
} from '../utils/authSecurity';

export const AuthScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  const {
    isLoading,
    error,
    isPasswordRecoveryMode,
    recoveryEmail,
    pendingOAuthUser,
    signInWithPassword,
    sendPin,
    verifyPin,
    completeRegistration,
    signInWithSocial,
    forgotPassword,
    verifyRecoveryOtp,
    resetUserPassword,
    clearPasswordRecoveryMode,
    clearPendingOAuthUser,
    clearErrors,
  } = useAuth();

  const initialRouteState = useMemo(() => {
    if (isPasswordRecoveryMode) {
      return { mode: 'reset_password' as const, signUpStage: 'email' as const };
    }
    if (pendingOAuthUser) {
      return { mode: 'sign_up' as const, signUpStage: 'profile' as const };
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const parsed = parseAuthRouteFromPath(window.location.pathname);
      if (parsed) return parsed;
    }
    return { mode: 'sign_in' as const, signUpStage: 'email' as const };
  }, []);

  // Mode: 'sign_in' | 'sign_up' | 'forgot_password' | 'reset_password'
  const [mode, setMode] = useState<'sign_in' | 'sign_up' | 'forgot_password' | 'reset_password'>(
    initialRouteState.mode
  );

  // Sign In states
  const [signInEmail, setSignInEmail] = useState<string>('');
  const [signInPassword, setSignInPassword] = useState<string>('');
  const [showSignInPassword, setShowSignInPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Forgot password & Reset password states
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [isForgotBusy, setIsForgotBusy] = useState<boolean>(false);
  const [resetEmailDispatched, setResetEmailDispatched] = useState<boolean>(false);
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [confirmResetPassword, setConfirmResetPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [copiedPasswordNotice, setCopiedPasswordNotice] = useState<boolean>(false);

  // Sign Up Multi-Stage State ('email' | 'pin' | 'profile')
  const [signUpStage, setSignUpStage] = useState<'email' | 'pin' | 'profile'>(
    initialRouteState.signUpStage
  );
  const [registerEmail, setRegisterEmail] = useState<string>(pendingOAuthUser?.email || '');
  const [pin, setPin] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(60);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  // Stage 3 Profile Setup states
  const { corporateAccounts, ensureCorporateAccountsLoaded } = useCart();
  const availableCompanies = corporateAccounts.length > 0 ? corporateAccounts : INITIAL_CORPORATE_ACCOUNTS;
  const [fullName, setFullName] = useState<string>(pendingOAuthUser?.fullName || '');
  const [regPassword, setRegPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [selectedCompany, setSelectedCompany] = useState<CorporateAccount>(availableCompanies[0]);
  const [selectedLocation, setSelectedLocation] = useState<string>(availableCompanies[0]?.locations[0] || 'Rosebank Office Park');
  const [deliveryFloor] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  // Automatically switch to 'reset_password' mode when redirected from email recovery link
  useEffect(() => {
    if (isPasswordRecoveryMode) {
      setMode('reset_password');
    }
  }, [isPasswordRecoveryMode]);

  // Pre-populate Stage 3 ("Complete Your Profile") when a new user signs in with Google or Apple OAuth
  useEffect(() => {
    if (pendingOAuthUser) {
      setMode('sign_up');
      setSignUpStage('profile');
      if (pendingOAuthUser.email) {
        setRegisterEmail(pendingOAuthUser.email);
      }
      if (pendingOAuthUser.fullName) {
        setFullName((prev) => prev || pendingOAuthUser.fullName);
      }
    }
  }, [pendingOAuthUser]);

  // Synchronize current auth mode & stage with distinct URL endpoints (/auth/login, /auth/register, /auth/verify, /auth/complete-profile, etc.)
  useEffect(() => {
    const targetPath = getAuthEndpointPath(mode, signUpStage);
    syncBrowserHistoryPath(targetPath);
  }, [mode, signUpStage]);

  // Listen to browser Back / Forward navigation on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handlePopState = () => {
      const parsed = parseAuthRouteFromPath(window.location.pathname);
      if (parsed) {
        setMode(parsed.mode);
        setSignUpStage(parsed.signUpStage);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // The company list needs a verified session, so it loads at the profile stage.
  useEffect(() => {
    if (mode === 'sign_up' && signUpStage === 'profile') {
      ensureCorporateAccountsLoaded(true);
    }
  }, [mode, signUpStage]);

  // Sync selected company when live corporate accounts load from DB
  useEffect(() => {
    if (corporateAccounts.length > 0) {
      const match = corporateAccounts.find((c) => c.id === selectedCompany?.id);
      if (!match) {
        setSelectedCompany(corporateAccounts[0]);
        setSelectedLocation(corporateAccounts[0].locations[0] || '');
      }
    }
  }, [corporateAccounts]);

  // Company Confirmation Modal
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Countdown timer for 8-digit PIN
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isTimerActive && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0) {
      setIsTimerActive(false);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTimerActive, countdown]);

  const startPinTimer = () => {
    setCountdown(60);
    setIsTimerActive(true);
  };

  // Password Strength Criteria
  const passwordCriteria = useMemo(() => {
    const hasMinLength = regPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(regPassword);
    const hasLower = /[a-z]/.test(regPassword);
    const hasNumber = /[0-9]/.test(regPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(regPassword);
    const score = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      score,
      isStrong: score === 5,
    };
  }, [regPassword]);

  const passwordsMatch = regPassword.length > 0 && regPassword === confirmPassword;

  // Reset Password Strength Criteria
  const resetPasswordCriteria = useMemo(() => {
    const hasMinLength = newResetPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newResetPassword);
    const hasLower = /[a-z]/.test(newResetPassword);
    const hasNumber = /[0-9]/.test(newResetPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newResetPassword);
    const score = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    return {
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      score,
      isStrong: score >= 4 && hasMinLength,
    };
  }, [newResetPassword]);

  const resetPasswordsMatch =
    newResetPassword.length > 0 && newResetPassword === confirmResetPassword;

  // ---------------- Handlers ----------------

  const handleSignInSubmit = async () => {
    if (!signInEmail.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    if (!signInPassword) {
      Alert.alert('Missing Password', 'Please enter your password.');
      return;
    }
    await signInWithPassword(signInEmail.trim(), signInPassword);
  };

  const handleForgotPasswordSubmit = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setIsForgotBusy(true);
    const sent = await forgotPassword(forgotEmail.trim());
    setIsForgotBusy(false);
    if (sent) {
      setResetEmailDispatched(true);
      Alert.alert(
        'Reset Request Dispatched',
        `If an account exists for ${forgotEmail.trim()}, a recovery code is on its way.\n\nEnter the 8-digit code from the email below.`
      );
    }
  };

  const handleVerifyRecoveryCode = async () => {
    const targetEmail = forgotEmail.trim() || recoveryEmail;
    if (!targetEmail) {
      Alert.alert('Email Required', 'Please enter your email address above.');
      return;
    }
    if (recoveryCode.trim().length !== OTP_LENGTH) {
      Alert.alert('Invalid Code', 'Please enter the 8-digit recovery code from your email.');
      return;
    }
    const verified = await verifyRecoveryOtp(targetEmail, recoveryCode.trim());
    if (verified) {
      setMode('reset_password');
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (newResetPassword.length < 8) {
      Alert.alert('Password Too Short', 'Please enter a new password with at least 8 characters.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      Alert.alert('Password Mismatch', 'Your new password and confirmation password do not match.');
      return;
    }
    const success = await resetUserPassword(newResetPassword);
    if (success) {
      setNewResetPassword('');
      setConfirmResetPassword('');
      setResetEmailDispatched(false);
      Alert.alert(
        'Password Updated',
        'Your password has been securely updated.',
        [
          {
            text: 'Continue',
            onPress: () => {
              clearPasswordRecoveryMode();
              setMode('sign_in');
            },
          },
        ]
      );
    }
  };

  const handleSendPin = async () => {
    const cleanEmail = registerEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid personal or corporate email address.');
      return;
    }
    const sent = await sendPin(cleanEmail);
    if (sent) {
      startPinTimer();
      setSignUpStage('pin');
      Alert.alert(
        'PIN Sent',
        `We've emailed an 8-digit code to ${cleanEmail}. Please check your inbox.`
      );
    }
  };

  const handleGenerateStrongPassword = async (target: 'register' | 'reset') => {
    const generated = generateStrongPassword(16);
    if (target === 'register') {
      setRegPassword(generated);
      setConfirmPassword(generated);
      setShowRegPassword(true);
    } else {
      setNewResetPassword(generated);
      setConfirmResetPassword(generated);
      setShowResetPassword(true);
    }
    const copied = await copyToClipboard(generated);
    if (copied) {
      setCopiedPasswordNotice(true);
      setTimeout(() => setCopiedPasswordNotice(false), 3500);
    }
  };

  const handleCopyPassword = async (pwd: string) => {
    if (!pwd) return;
    const copied = await copyToClipboard(pwd);
    if (copied) {
      setCopiedPasswordNotice(true);
      setTimeout(() => setCopiedPasswordNotice(false), 3500);
    } else {
      Alert.alert('Generated Password', pwd);
    }
  };

  const handleVerifyPin = async () => {
    if (pin.trim().length !== OTP_LENGTH) {
      Alert.alert('Invalid PIN', 'Please enter the 8-digit numeric verification PIN.');
      return;
    }
    const verified = await verifyPin(registerEmail, pin.trim());
    if (verified) {
      setSignUpStage('profile');
    }
  };

  const handleResendPin = async () => {
    if (countdown > 0) return;
    await sendPin(registerEmail);
    startPinTimer();
    Alert.alert('PIN Dispatched', `A fresh 8-digit code has been dispatched to ${registerEmail}.`);
  };

  const handleProfilePreSubmit = () => {
    if (!fullName.trim() || fullName.trim().length < 3) {
      Alert.alert('Full Name Required', 'Please enter your full name (at least 3 characters).');
      return;
    }
    const phoneDigits = phoneNumber.replace(/\D/g, '').length;
    if (phoneDigits < 9 || phoneDigits > 15) {
      Alert.alert('Phone Number Required', 'Please enter a valid phone number.');
      return;
    }
    if (!passwordCriteria.isStrong) {
      Alert.alert('Strong Password Required', 'Please ensure your password satisfies all 5 security requirements.');
      return;
    }
    if (!passwordsMatch) {
      Alert.alert('Password Mismatch', 'Your passwords do not match. Please verify.');
      return;
    }
    if (!selectedCompany || !selectedLocation) {
      Alert.alert('Company Required', 'Please select your assigned company and delivery drop-off location.');
      return;
    }

    // Show mandatory verification pop-up
    setIsConfirmModalVisible(true);
  };

  const handleFinalConfirmRegistration = async () => {
    setIsConfirmModalVisible(false);
    setIsSubmitting(true);
    try {
      await completeRegistration({
        fullName: fullName.trim(),
        password: regPassword,
        companyId: selectedCompany.id,
        companyName: selectedCompany.companyName,
        locationName: selectedLocation,
        deliveryFloor: deliveryFloor.trim(),
        phoneNumber: phoneNumber.trim(),
        email: registerEmail.trim().toLowerCase(),
      });
    } catch (err: any) {
      Alert.alert('Registration Error', err.message || 'Could not finalize registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Centered Brand Header - Lower & Prominent Hero Logo */}
          <View style={styles.logoSection}>
            <BrandLogo variant="hero" />
          </View>

          {/* Global Error Banner */}
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: theme.errorSurface, borderColor: theme.errorBorder }]}>
              <Ionicons name="alert-circle" size={18} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* ═══════════════════════════════════════════════
              MODE 1: LOG IN (MINIMAL, SLICK & BORDERLESS)
             ═══════════════════════════════════════════════ */}
          {mode === 'sign_in' && (
            <View style={styles.formContainer}>
              {/* Email Input with Inline Placeholder */}
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="mail-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={signInEmail}
                  onChangeText={setSignInEmail}
                  placeholder="Email Address (e.g. alex@example.com)"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.textInput, { color: theme.textPrimary }]}
                />
              </View>

              {/* Password Input with Inline Placeholder */}
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, marginTop: 12 }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={signInPassword}
                  onChangeText={setSignInPassword}
                  placeholder="Password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showSignInPassword}
                  autoCapitalize="none"
                  style={[styles.textInput, { color: theme.textPrimary }]}
                />
                <TouchableOpacity
                  onPress={() => setShowSignInPassword((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showSignInPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Remember me & Forgot Password */}
              <View style={styles.rowBetween}>
                <TouchableOpacity
                  onPress={() => setRememberMe((v) => !v)}
                  style={styles.rememberRow}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={rememberMe ? 'checkbox' : 'square-outline'}
                    size={19}
                    color={rememberMe ? theme.primary : theme.textMuted}
                  />
                  <Text style={[styles.smallLabel, { color: theme.textSecondary, marginLeft: 6 }]}>
                    Remember me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    clearErrors();
                    setForgotEmail(signInEmail);
                    setMode('forgot_password');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Log In Button */}
              <TouchableOpacity
                onPress={handleSignInSubmit}
                disabled={isLoading}
                activeOpacity={0.8}
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.textInverse} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>Log In</Text>
                )}
              </TouchableOpacity>

              {/* Social Login Options */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.surfaceBorder }]} />
                <Text style={[styles.dividerText, { color: theme.textMuted }]}>or continue with</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.surfaceBorder }]} />
              </View>

              <View style={styles.socialRow}>
                <TouchableOpacity
                  onPress={() => signInWithSocial('apple')}
                  activeOpacity={0.8}
                  style={[styles.socialBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.surfaceElevated }]}
                >
                  <Ionicons name="logo-apple" size={18} color={theme.textPrimary} />
                  <Text style={[styles.socialBtnText, { color: theme.textPrimary }]}>Apple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => signInWithSocial('google')}
                  activeOpacity={0.8}
                  style={[styles.socialBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.surfaceElevated }]}
                >
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
                  <Text style={[styles.socialBtnText, { color: theme.textPrimary }]}>Google</Text>
                </TouchableOpacity>
              </View>

              {/* Bottom Switcher link */}
              <View style={styles.footerLinkRow}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => {
                    clearErrors();
                    setSignUpStage('email');
                    setMode('sign_up');
                  }}
                >
                  <Text style={[styles.boldLink, { color: theme.primary }]}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════
              MODE 2: FORGOT PASSWORD (SEND RESET LINK / CODE)
             ═══════════════════════════════════════════════ */}
          {mode === 'forgot_password' && (
            <View style={styles.formContainer}>
              <TouchableOpacity
                onPress={() => {
                  clearErrors();
                  setResetEmailDispatched(false);
                  setMode('sign_in');
                }}
                style={styles.backRow}
              >
                <Ionicons name="arrow-back" size={16} color={theme.primary} />
                <Text style={[styles.backText, { color: theme.primary }]}>Back to Log In</Text>
              </TouchableOpacity>

              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Forgot Password</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                Enter your email address below. We will send a password reset link and code to your inbox.
              </Text>

              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="mail-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="Email Address (e.g. alex@example.com)"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.textInput, { color: theme.textPrimary }]}
                />
              </View>

              <TouchableOpacity
                onPress={handleForgotPasswordSubmit}
                disabled={isForgotBusy}
                activeOpacity={0.8}
                style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: 14 }]}
              >
                {isForgotBusy ? (
                  <ActivityIndicator color={theme.textInverse} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>
                    {resetEmailDispatched ? 'RESEND RESET REQUEST' : 'SEND RESET LINK'}
                  </Text>
                )}
              </TouchableOpacity>

              {resetEmailDispatched && (
                <View style={[styles.dropoffNoticeCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, marginTop: 18, flexDirection: 'column' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="mail-unread-outline" size={18} color={theme.primary} />
                    <Text style={[styles.dropoffNoticeTitle, { color: theme.textPrimary, marginLeft: 8 }]}>
                      Check your email inbox
                    </Text>
                  </View>
                  <Text style={[styles.dropoffNoticeBody, { color: theme.textSecondary, marginBottom: 12 }]}>
                    Enter the 8-digit recovery code from the email below.
                  </Text>

                  <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                    <Ionicons name="key-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                    <TextInput
                      value={recoveryCode}
                      onChangeText={setRecoveryCode}
                      placeholder="8-Digit Recovery Code"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      style={[styles.textInput, { color: theme.textPrimary }]}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleVerifyRecoveryCode}
                    disabled={isLoading || recoveryCode.trim().length !== OTP_LENGTH}
                    activeOpacity={0.8}
                    style={[
                      styles.secondaryButton,
                      {
                        borderColor: theme.primary,
                        backgroundColor: theme.primaryMuted,
                        opacity: recoveryCode.trim().length === OTP_LENGTH ? 1 : 0.6,
                      },
                    ]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                      VERIFY CODE &amp; SET NEW PASSWORD
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════
              MODE 2B: RESET PASSWORD (INSERT & CONFIRM NEW PASSWORD)
             ═══════════════════════════════════════════════ */}
          {mode === 'reset_password' && (
            <View style={styles.formContainer}>
              <TouchableOpacity
                onPress={() => {
                  clearErrors();
                  clearPasswordRecoveryMode();
                  setMode('sign_in');
                }}
                style={styles.backRow}
              >
                <Ionicons name="arrow-back" size={16} color={theme.primary} />
                <Text style={[styles.backText, { color: theme.primary }]}>Back to Log In</Text>
              </TouchableOpacity>

              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Create New Password</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                {recoveryEmail
                  ? `Setting a new password for ${recoveryEmail}.`
                  : 'Insert your new password below and confirm it to regain access to your account.'}
              </Text>

              {/* Generate Strong Password Action Row */}
              <View style={styles.generatePwdRow}>
                <TouchableOpacity
                  onPress={() => handleGenerateStrongPassword('reset')}
                  activeOpacity={0.8}
                  style={[
                    styles.generatePwdBtn,
                    { backgroundColor: theme.primaryMuted, borderColor: theme.primary },
                  ]}
                >
                  <Ionicons name="key-outline" size={15} color={theme.primary} />
                  <Text style={[styles.generatePwdBtnText, { color: theme.primary }]}>
                    Generate Strong Password
                  </Text>
                </TouchableOpacity>

                {newResetPassword.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleCopyPassword(newResetPassword)}
                    activeOpacity={0.8}
                    style={[
                      styles.copyPwdBtn,
                      { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder },
                    ]}
                  >
                    <Ionicons
                      name={copiedPasswordNotice ? 'checkmark-circle' : 'copy-outline'}
                      size={14}
                      color={copiedPasswordNotice ? theme.success : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.copyPwdBtnText,
                        { color: copiedPasswordNotice ? theme.success : theme.textSecondary },
                      ]}
                    >
                      {copiedPasswordNotice ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Insert New Password Box (matching Sign In input box style) */}
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={newResetPassword}
                  onChangeText={setNewResetPassword}
                  placeholder="Insert New Password (min. 8 characters)"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showResetPassword}
                  autoCapitalize="none"
                  style={[styles.textInput, { color: theme.textPrimary }]}
                />
                <TouchableOpacity
                  onPress={() => setShowResetPassword((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showResetPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Criteria */}
              {newResetPassword.length > 0 && (
                <View style={[styles.criteriaGrid, { marginBottom: 4 }]}>
                  <Text style={[styles.criteriaItem, { color: resetPasswordCriteria.hasMinLength ? theme.success : theme.textMuted }]}>
                    {resetPasswordCriteria.hasMinLength ? '✓' : '○'} 8+ Characters
                  </Text>
                  <Text style={[styles.criteriaItem, { color: resetPasswordCriteria.hasUpper ? theme.success : theme.textMuted }]}>
                    {resetPasswordCriteria.hasUpper ? '✓' : '○'} Uppercase
                  </Text>
                  <Text style={[styles.criteriaItem, { color: resetPasswordCriteria.hasLower ? theme.success : theme.textMuted }]}>
                    {resetPasswordCriteria.hasLower ? '✓' : '○'} Lowercase
                  </Text>
                  <Text style={[styles.criteriaItem, { color: resetPasswordCriteria.hasNumber ? theme.success : theme.textMuted }]}>
                    {resetPasswordCriteria.hasNumber ? '✓' : '○'} Number
                  </Text>
                  <Text style={[styles.criteriaItem, { color: resetPasswordCriteria.hasSpecial ? theme.success : theme.textMuted }]}>
                    {resetPasswordCriteria.hasSpecial ? '✓' : '○'} Special Symbol
                  </Text>
                </View>
              )}

              {/* Confirm New Password Box (matching Sign In input box style) */}
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, marginTop: 12 }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={confirmResetPassword}
                  onChangeText={setConfirmResetPassword}
                  placeholder="Confirm New Password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showResetPassword}
                  autoCapitalize="none"
                  style={[styles.textInput, { color: theme.textPrimary }]}
                />
              </View>

              {confirmResetPassword.length > 0 && (
                <Text style={{ fontSize: 12, color: resetPasswordsMatch ? theme.success : theme.error, marginTop: 6, marginLeft: 4 }}>
                  {resetPasswordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                </Text>
              )}

              <TouchableOpacity
                onPress={handleResetPasswordSubmit}
                disabled={isLoading || !resetPasswordsMatch || newResetPassword.length < 8}
                activeOpacity={0.8}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                    marginTop: 18,
                    opacity: resetPasswordsMatch && newResetPassword.length >= 8 ? 1 : 0.6,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.textInverse} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>
                    CONFIRM &amp; UPDATE PASSWORD
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════════════════════════════════════════════
              MODE 3: SIGN UP (3-STAGE ONBOARDING)
             ═══════════════════════════════════════════════ */}
          {mode === 'sign_up' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              {/* Back to Log In */}
              <TouchableOpacity
                onPress={() => {
                  clearErrors();
                  clearPendingOAuthUser();
                  setSignUpStage('email');
                  setMode('sign_in');
                }}
                style={styles.backRow}
              >
                <Ionicons name="arrow-back" size={16} color={theme.primary} />
                <Text style={[styles.backText, { color: theme.primary }]}>Back to Log In</Text>
              </TouchableOpacity>

              {/* Stepper Indicator */}
              <View style={styles.stepperContainer}>
                <View style={[styles.stepDot, signUpStage === 'email' ? styles.stepDotActive : styles.stepDotCompleted, { borderColor: theme.primary, backgroundColor: signUpStage === 'email' ? theme.primary : theme.primaryMuted }]}>
                  <Text style={[styles.stepDotText, { color: signUpStage === 'email' ? theme.textInverse : theme.primary }]}>1</Text>
                </View>
                <View style={[styles.stepLine, { backgroundColor: signUpStage !== 'email' ? theme.primary : theme.surfaceBorder }]} />
                <View style={[styles.stepDot, signUpStage === 'pin' ? styles.stepDotActive : signUpStage === 'profile' ? styles.stepDotCompleted : styles.stepDotInactive, { borderColor: theme.primary, backgroundColor: signUpStage === 'pin' ? theme.primary : signUpStage === 'profile' ? theme.primaryMuted : theme.surfaceElevated }]}>
                  <Text style={[styles.stepDotText, { color: signUpStage === 'pin' ? theme.textInverse : theme.primary }]}>2</Text>
                </View>
                <View style={[styles.stepLine, { backgroundColor: signUpStage === 'profile' ? theme.primary : theme.surfaceBorder }]} />
                <View style={[styles.stepDot, signUpStage === 'profile' ? styles.stepDotActive : styles.stepDotInactive, { borderColor: theme.primary, backgroundColor: signUpStage === 'profile' ? theme.primary : theme.surfaceElevated }]}>
                  <Text style={[styles.stepDotText, { color: signUpStage === 'profile' ? theme.textInverse : theme.textMuted }]}>3</Text>
                </View>
              </View>

              {/* ── STAGE 1: EMAIL ENTRY ── */}
              {signUpStage === 'email' && (
                <>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Create Your Account</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                    Enter your email to receive a 8-digit authentication PIN code.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email Address</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                      <Ionicons name="mail-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                      <TextInput
                        value={registerEmail}
                        onChangeText={setRegisterEmail}
                        placeholder="personal or corporate email"
                        placeholderTextColor={theme.textMuted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={[styles.textInput, { color: theme.textPrimary }]}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleSendPin}
                    disabled={isLoading || !registerEmail.trim()}
                    activeOpacity={0.8}
                    style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: registerEmail.trim() ? 1 : 0.6 }]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={theme.textInverse} />
                    ) : (
                      <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>Authenticate</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.footerLinkRow}>
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => setMode('sign_in')}>
                      <Text style={[styles.boldLink, { color: theme.primary }]}>Log In</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── STAGE 2: 6-DIGIT PIN VERIFICATION ── */}
              {signUpStage === 'pin' && (
                <>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Enter 8-Digit PIN</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                    We've sent a 8-digit code to <Text style={{ color: theme.primary, fontWeight: '700' }}>{registerEmail}</Text>.
                  </Text>

                  <View style={styles.inputGroup}>
                    <View style={[styles.pinBoxWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                      <TextInput
                        value={pin}
                        onChangeText={setPin}
                        placeholder="••••••••"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="number-pad"
                        maxLength={OTP_LENGTH}
                        style={[styles.pinInput, { color: theme.textPrimary }]}
                      />
                    </View>
                    <Text style={[styles.helperNotice, { color: theme.textMuted, textAlign: 'center' }]}>
                      Check your email inbox (and spam folder) for your 8-digit verification code.
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleVerifyPin}
                    disabled={isLoading || pin.trim().length !== OTP_LENGTH}
                    activeOpacity={0.8}
                    style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: pin.trim().length === OTP_LENGTH ? 1 : 0.6 }]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={theme.textInverse} />
                    ) : (
                      <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>VERIFY &amp; PROCEED</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.resendRow}>
                    {isTimerActive ? (
                      <Text style={[styles.timerText, { color: theme.textMuted }]}>
                        Resend code in {countdown}s
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={handleResendPin}>
                        <Text style={[styles.boldLink, { color: theme.primary }]}>Resend 8-Digit PIN</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => setSignUpStage('email')}
                    style={styles.changeEmailRow}
                  >
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Incorrect email? Change address</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── STAGE 3: PROFILE SETUP & CORPORATE DROP-OFF BINDING ── */}
              {signUpStage === 'profile' && (
                <>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Complete Your Profile</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                    All fields are required. Please set a unique password and review your company drop-off carefully.
                  </Text>

                  {pendingOAuthUser ? (
                    <View
                      style={[
                        styles.dropoffNoticeCard,
                        {
                          backgroundColor: theme.primaryMuted,
                          borderColor: theme.primary,
                          marginBottom: 14,
                          marginTop: 0,
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <Ionicons
                        name={pendingOAuthUser.provider === 'apple' ? 'logo-apple' : 'logo-google'}
                        size={18}
                        color={theme.primary}
                      />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.dropoffNoticeTitle, { color: theme.textPrimary }]}>
                          Verified via {pendingOAuthUser.provider === 'apple' ? 'Apple' : 'Google'} ({pendingOAuthUser.email})
                        </Text>
                        <Text style={[styles.dropoffNoticeBody, { color: theme.textSecondary }]}>
                          Your name has been pre-populated below. Please create a strong password and choose your corporate drop-off station to finish.
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Full Name */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name *</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                      <Ionicons name="person-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                      <TextInput
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="e.g. Alex Van Der Berg"
                        placeholderTextColor={theme.textMuted}
                        style={[styles.textInput, { color: theme.textPrimary }]}
                      />
                    </View>
                  </View>

                  {/* Phone Number */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Phone Number *</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                      <Ionicons name="call-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                      <TextInput
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="Your mobile number"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        style={[styles.textInput, { color: theme.textPrimary }]}
                      />
                    </View>
                  </View>

                  {/* Password */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRowBetween}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: 0 }]}>
                        Strong Password *
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => handleGenerateStrongPassword('register')}
                          activeOpacity={0.8}
                          style={[
                            styles.generatePwdBtnSmall,
                            { backgroundColor: theme.primaryMuted, borderColor: theme.primary },
                          ]}
                        >
                          <Ionicons name="key-outline" size={13} color={theme.primary} />
                          <Text style={[styles.generatePwdBtnSmallText, { color: theme.primary }]}>
                            Generate Strong Password
                          </Text>
                        </TouchableOpacity>

                        {regPassword.length > 0 && (
                          <TouchableOpacity
                            onPress={() => handleCopyPassword(regPassword)}
                            activeOpacity={0.8}
                            style={[
                              styles.copyPwdBtnSmall,
                              { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder },
                            ]}
                          >
                            <Ionicons
                              name={copiedPasswordNotice ? 'checkmark-circle' : 'copy-outline'}
                              size={12}
                              color={copiedPasswordNotice ? theme.success : theme.textSecondary}
                            />
                            <Text
                              style={[
                                styles.copyPwdBtnSmallText,
                                { color: copiedPasswordNotice ? theme.success : theme.textSecondary },
                              ]}
                            >
                              {copiedPasswordNotice ? 'Copied' : 'Copy'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, marginTop: 6 }]}>
                      <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                      <TextInput
                        value={regPassword}
                        onChangeText={setRegPassword}
                        placeholder="Min 8 characters"
                        placeholderTextColor={theme.textMuted}
                        secureTextEntry={!showRegPassword}
                        autoCapitalize="none"
                        style={[styles.textInput, { color: theme.textPrimary }]}
                      />
                      <TouchableOpacity onPress={() => setShowRegPassword((v) => !v)} style={styles.eyeBtn}>
                        <Ionicons name={showRegPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Password Criteria Checklist */}
                    <View style={styles.criteriaGrid}>
                      <Text style={[styles.criteriaItem, { color: passwordCriteria.hasMinLength ? theme.success : theme.textMuted }]}>
                        {passwordCriteria.hasMinLength ? '✓' : '○'} 8+ Characters
                      </Text>
                      <Text style={[styles.criteriaItem, { color: passwordCriteria.hasUpper ? theme.success : theme.textMuted }]}>
                        {passwordCriteria.hasUpper ? '✓' : '○'} Uppercase
                      </Text>
                      <Text style={[styles.criteriaItem, { color: passwordCriteria.hasLower ? theme.success : theme.textMuted }]}>
                        {passwordCriteria.hasLower ? '✓' : '○'} Lowercase
                      </Text>
                      <Text style={[styles.criteriaItem, { color: passwordCriteria.hasNumber ? theme.success : theme.textMuted }]}>
                        {passwordCriteria.hasNumber ? '✓' : '○'} Number
                      </Text>
                      <Text style={[styles.criteriaItem, { color: passwordCriteria.hasSpecial ? theme.success : theme.textMuted }]}>
                        {passwordCriteria.hasSpecial ? '✓' : '○'} Special Symbol
                      </Text>
                    </View>
                  </View>

                  {/* Confirm Password */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Confirm Password *</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                      <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Re-enter password"
                        placeholderTextColor={theme.textMuted}
                        secureTextEntry={!showRegPassword}
                        autoCapitalize="none"
                        style={[styles.textInput, { color: theme.textPrimary }]}
                      />
                    </View>
                    {confirmPassword.length > 0 && (
                      <Text style={{ fontSize: 11, color: passwordsMatch ? theme.success : theme.error, marginTop: 4 }}>
                        {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                      </Text>
                    )}
                  </View>

                  {/* Company Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Company Delivery Drop-off *</Text>
                    {availableCompanies.map((company) => {
                      const isSelected = selectedCompany?.id === company.id;
                      return (
                        <TouchableOpacity
                          key={company.id}
                          onPress={() => {
                            setSelectedCompany(company);
                            setSelectedLocation(company.locations[0]);
                          }}
                          activeOpacity={0.8}
                          style={[
                            styles.companyOptionCard,
                            {
                              backgroundColor: isSelected ? theme.primaryMuted : theme.surfaceElevated,
                              borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={isSelected ? theme.primary : theme.textMuted}
                          />
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={[styles.companyOptionTitle, { color: theme.textPrimary }]}>{company.companyName}</Text>
                            <Text style={[styles.companyOptionSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                              {company.locations[0]}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Prominent Warning Callout */}
                  <View style={[styles.dropoffNoticeCard, { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }]}>
                    <Ionicons name="information-circle" size={20} color={theme.primary} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.dropoffNoticeTitle, { color: theme.textPrimary }]}>
                        Binding Delivery Location
                      </Text>
                      <Text style={[styles.dropoffNoticeBody, { color: theme.textSecondary }]}>
                        Orders are delivered exclusively to your company's designated drop-off station. This cannot be modified after registration.
                      </Text>
                    </View>
                  </View>

                  {/* Complete Sign In / Register Button */}
                  <TouchableOpacity
                    onPress={handleProfilePreSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                    style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: 16 }]}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={theme.textInverse} />
                    ) : (
                      <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>
                        SIGN IN &amp; COMPLETE REGISTRATION
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════════════════════════════════════════════
          MODAL: IRREVERSIBLE COMPANY CONFIRMATION POP-UP
         ═══════════════════════════════════════════════ */}
      <Modal
        visible={isConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={[styles.modalIconCircle, { backgroundColor: theme.errorSurface }]}>
              <Ionicons name="alert" size={28} color={theme.error} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Verify Company Details
            </Text>

            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              Please verify that <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{selectedCompany?.companyName}</Text> and the location <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{selectedLocation}</Text> are correct.
            </Text>

            <View style={[styles.modalWarningBox, { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }]}>
              <Text style={[styles.modalWarningText, { color: theme.textPrimary }]}>
                ⚠️ <Text style={{ fontWeight: '700' }}>This selection CANNOT be changed later.</Text> If a mistake is made, kitchen administrators must completely purge your profile before you can re-register.
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setIsConfirmModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Review Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleFinalConfirmRegistration}
                style={[styles.modalConfirmBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.modalConfirmText, { color: theme.textInverse }]}>Yes, Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 76,
    marginBottom: 36,
  },
  formContainer: {
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  demoSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  demoToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  demoToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  switcherContainer: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  switcherBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherBtnActive: {},
  switcherText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.bodyBold,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: typography.heading,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallLabel: {
    fontSize: 13,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    paddingHorizontal: 10,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  demoBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  demoBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoBoxSubtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  boldLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {},
  stepDotCompleted: {},
  stepDotInactive: {
    borderColor: '#CCC',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  helperNotice: {
    fontSize: 11,
    marginTop: 5,
    lineHeight: 15,
  },
  pinBoxWrapper: {
    borderRadius: 12,
    borderWidth: 1.5,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  timerText: {
    fontSize: 12,
  },
  changeEmailRow: {
    alignItems: 'center',
    marginTop: 14,
  },
  criteriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  criteriaItem: {
    fontSize: 11,
    marginRight: 6,
  },
  companyOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  companyOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  companyOptionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  dropoffNoticeCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  dropoffNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  dropoffNoticeBody: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(213, 50, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: typography.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 14,
  },
  modalWarningBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  modalWarningText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
  },
  generatePwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  generatePwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  generatePwdBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  copyPwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  copyPwdBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  generatePwdBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  generatePwdBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
  },
  copyPwdBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  copyPwdBtnSmallText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
