import React, { useMemo, useRef, useState } from 'react';
import {
  Animated, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
  import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import KitchenLogo from '../components/KitchenLogo';
import { Ionicons } from '@expo/vector-icons';
import { findCompanyForEmail } from '../utils/companyMatch';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_EMAIL = 'admin@gmail.com';

export default function LoginScreen() {
  const { login, companies } = useKitchen();
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Corporate clients are matched by work-email domain — no manual
  // "which company do you work for" entry needed.
  const matchedCompany = useMemo(() => findCompanyForEmail(email, companies), [email, companies]);

  // Mode states
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  
  // UI states
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; confirmPassword?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  // Scales the gap above the logo with the actual screen — a fixed pixel
  // value looked right on a Pixel-sized phone but would be cramped on a
  // small SE-class screen and too tight on a tall/tablet one. 5% of screen
  // height, clamped so short screens still keep some breathing room and
  // tall/tablet screens don't push the form too far down.
  const { height: windowHeight } = useWindowDimensions();
  const brandTopOffset = Math.max(20, Math.min(56, windowHeight * 0.05));

  // The form itself is built from fixed pixel sizes, which is fine on a
  // ~390-430pt-tall-viewport phone but eats a much bigger share of a short,
  // iPhone SE/8-class (667pt) screen — same content, less room, so it reads
  // as "bigger" even though nothing actually grew. Below that height, shrink
  // the header (the single biggest chunk of fixed space) and trim a couple
  // of section gaps so proportions hold up on small screens too.
  const isCompactHeight = windowHeight < 700;
  const glowSize = isCompactHeight ? 100 : 130;
  const glowInnerSize = isCompactHeight ? 60 : 78;
  const brandMarginBottom = isCompactHeight ? 20 : 32;
  const sectionMarginBottom = isCompactHeight ? 10 : 14;

  const pressIn = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  const isAdminEmail = email.trim().toLowerCase() === ADMIN_EMAIL;

  const validateSignin = () => {
    const newErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      newErrors.email = 'Please enter your email';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Please enter your password';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors: { email?: string; password?: string; name?: string; confirmPassword?: string } = {};
    const trimmedEmail = email.trim();
    
    if (!name.trim()) {
      newErrors.name = 'Please enter your name';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!trimmedEmail) {
      newErrors.email = 'Please enter your email';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Please enter your password';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignin = () => {
    if (validateSignin()) {
      const role = isAdminEmail ? 'admin' : 'customer';
      // Re-check the domain on every sign-in too, so a company registered
      // after someone's original signup still gets linked retroactively.
      login(email.trim(), role, undefined, matchedCompany ? 'company' : undefined, matchedCompany?.name);
      // Admins land on Kitchen Controls — the customer Menu tab isn't part of their account.
      router.replace(role === 'admin' ? '/admin' : '/');
    }
  };

  const handleSignup = () => {
    if (validateSignup()) {
      const role = isAdminEmail ? 'admin' : 'customer';
      login(email.trim(), role, name.trim(), matchedCompany ? 'company' : 'individual', matchedCompany?.name);
      router.replace(role === 'admin' ? '/admin' : '/');
    }
  };

  const handleForgotPassword = () => {
    if (email.trim() && EMAIL_REGEX.test(email.trim())) {
      // Simulate password reset
      router.replace('/');
    } else {
      setErrors({ email: 'Please enter your email to reset password' });
    }
  };

  const handleModeChange = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode);
    setErrors({});
    setPassword('');
    setConfirmPassword('');
  };

    const renderSigninForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={[styles.inputWrapper, focusedField === 'signinEmail' && styles.inputWrapperFocused, errors.email ? styles.inputWrapperError : null]}>
          <Ionicons name="mail-outline" size={16} color={focusedField === 'signinEmail' ? '#000000' : '#6B6B6B'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="name@gmail.com"
            placeholderTextColor="#6B6B6B"
            value={email}
            onChangeText={(val) => { setEmail(val); if (errors.email) setErrors({ ...errors, email: undefined }); }}
            onFocus={() => setFocusedField('signinEmail')}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
          />
        </View>
        {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>PASSWORD</Text>
        <View style={[styles.inputWrapper, focusedField === 'signinPassword' && styles.inputWrapperFocused, errors.password ? styles.inputWrapperError : null]}>
          <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'signinPassword' ? '#000000' : '#6B6B6B'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#6B6B6B"
            value={password}
            onChangeText={(val) => { setPassword(val); if (errors.password) setErrors({ ...errors, password: undefined }); }}
            onFocus={() => setFocusedField('signinPassword')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleSignin}
          />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="#8E8E93" style={{ paddingHorizontal: 6 }} />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
      </View>

      <View style={styles.optionsRow}>
        <TouchableOpacity
          style={styles.rememberContainer}
          onPress={() => setRememberMe(!rememberMe)}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxSelected]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleModeChange('forgot')} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignupForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>FULL NAME</Text>
        <View style={[styles.inputWrapper, focusedField === 'name' && styles.inputWrapperFocused, errors.name ? styles.inputWrapperError : null]}>
          <Ionicons name="person-outline" size={16} color={focusedField === 'name' ? '#000000' : '#6B6B6B'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#6B6B6B"
            value={name}
            onChangeText={(val) => { setName(val); if (errors.name) setErrors({ ...errors, name: undefined }); }}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            autoCorrect={false}
            autoComplete="name"
            returnKeyType="next"
          />
        </View>
        {errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={[styles.inputWrapper, focusedField === 'signupEmail' && styles.inputWrapperFocused, errors.email ? styles.inputWrapperError : null]}>
          <Ionicons name="mail-outline" size={16} color={focusedField === 'signupEmail' ? '#000000' : '#6B6B6B'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="name@gmail.com"
            placeholderTextColor="#6B6B6B"
            value={email}
            onChangeText={(val) => { setEmail(val); if (errors.email) setErrors({ ...errors, email: undefined }); }}
            onFocus={() => setFocusedField('signupEmail')}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
          />
        </View>
        {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
        {/* Companies are matched by work-email domain — no manual "which
            company" entry. Individuals (gmail.com etc.) just sign up normally. */}
        {matchedCompany && (
          <View style={styles.companyDetectedRow}>
            <Ionicons name="business" size={14} color="#22C55E" />
            <Text style={styles.companyDetectedText}>
              Joining as <Text style={styles.companyDetectedName}>{matchedCompany.name}</Text>
            </Text>
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>PASSWORD</Text>
        <View style={[styles.inputWrapper, focusedField === 'signupPassword' && styles.inputWrapperFocused, errors.password ? styles.inputWrapperError : null]}>
          <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'signupPassword' ? '#000000' : '#6B6B6B'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Create a password"
            placeholderTextColor="#6B6B6B"
            value={password}
            onChangeText={(val) => { setPassword(val); if (errors.password) setErrors({ ...errors, password: undefined }); }}
            onFocus={() => setFocusedField('signupPassword')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
                        returnKeyType="next"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="#8E8E93" style={{ paddingHorizontal: 6 }} />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused, errors.confirmPassword ? styles.inputWrapperError : null]}>
          <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'confirmPassword' ? '#000000' : '#6B6B6B'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#6B6B6B"
            value={confirmPassword}
            onChangeText={(val) => { setConfirmPassword(val); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined }); }}
            onFocus={() => setFocusedField('confirmPassword')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={handleSignup}
          />
        </View>
        {errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
      </View>
    </>
  );

  const renderForgotForm = () => (
    <>
      <View style={styles.lockIconContainer}>
        <Ionicons name="lock-closed" size={24} color="#000000" />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={[styles.inputWrapper, focusedField === 'forgotEmail' && styles.inputWrapperFocused, errors.email ? styles.inputWrapperError : null]}>
          <Ionicons name="mail-outline" size={16} color={focusedField === 'forgotEmail' ? '#000000' : '#6B6B6B'} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#6B6B6B"
            value={email}
            onChangeText={(val) => { setEmail(val); if (errors.email) setErrors({ ...errors, email: undefined }); }}
            onFocus={() => setFocusedField('forgotEmail')}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={handleForgotPassword}
          />
        </View>
        {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}

        <Text style={styles.helpText}>
          We'll send you a link to reset your password
        </Text>
      </View>
    </>
  );

  const renderContent = () => {
    switch (mode) {
      case 'signin': return renderSigninForm();
      case 'signup': return renderSignupForm();
      case 'forgot': return renderForgotForm();
    }
  };

  const handleSubmit = () => {
    switch (mode) {
      case 'signin': return handleSignin();
      case 'signup': return handleSignup();
      case 'forgot': return handleForgotPassword();
    }
  };

  const isButtonDisabled = () => {
    switch (mode) {
      case 'signin': return !email.trim() || !password;
      case 'signup': return !name.trim() || !email.trim() || !password || !confirmPassword;
      case 'forgot': return !email.trim() || !EMAIL_REGEX.test(email.trim());
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        // Android already resizes the window for the keyboard (adjustResize,
        // Expo's default). KeyboardAvoidingView still registers its own
        // keyboard listeners and calls setState + LayoutAnimation.configureNext
        // on every keyboard show/hide event REGARDLESS of `behavior` (even
        // `undefined`) as long as it's enabled — that global layout animation
        // racing the native resize is what was knocking focus off the
        // TextInput mid-type. `enabled={false}` is the only prop that actually
        // turns all of that off, so disable it outright on Android.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
                    <View
            style={[
              styles.contentContainer,
              // Keep forms a comfortable reading width on tablet-sized frames.
              { width: '100%', maxWidth: 480, alignSelf: 'center' },
            ]}
          >
            {/* Brand */}
            <View style={[styles.brandSection, { marginTop: brandTopOffset, marginBottom: brandMarginBottom }]}>
              <View style={[styles.brandGlow, { width: glowSize, height: glowSize, top: -glowSize * 0.17 }]} pointerEvents="none">
                <View style={[styles.glowRing, styles.glowRingOuter, { width: glowSize, height: glowSize }]} />
                <View style={[styles.glowRing, styles.glowRingInner, { width: glowInnerSize, height: glowInnerSize }]} />
              </View>
              <KitchenLogo compact variant="onLight" />
            </View>

            {/* Mode Selector */}
            <View style={[styles.modeSelector, { marginBottom: sectionMarginBottom }]}>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
                onPress={() => handleModeChange('signin')}
              >
                <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
                onPress={() => handleModeChange('signup')}
              >
                <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={[styles.formSection, { marginBottom: sectionMarginBottom }]}>
              <Text style={styles.heading}>
                {mode === 'signin' && 'Welcome back!'}
                {mode === 'signup' && 'Create your account'}
                {mode === 'forgot' && 'Reset your password'}
              </Text>
              <Text style={styles.subtext}>
                {mode === 'signin' && 'Sign in to continue ordering delicious meals'}
                {mode === 'signup' && 'Join Kitchen Co. for the best culinary experience'}
                {mode === 'forgot' && 'Enter your email to receive reset instructions'}
              </Text>

              {renderContent()}

              {/* Admin hint */}
              {isAdminEmail && mode !== 'forgot' && (
                <View style={styles.adminHint}>
                  <Text style={styles.adminHintIcon}>👑</Text>
                  <Text style={styles.adminHintText}>Admin access detected</Text>
                </View>
              )}

              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <TouchableOpacity
                  style={[styles.continueBtn, isButtonDisabled() && styles.continueBtnDisabled]}
                  onPress={handleSubmit}
                  onPressIn={pressIn}
                  onPressOut={pressOut}
                  activeOpacity={0.9}
                  disabled={isButtonDisabled()}
                >
                  <Text style={[styles.continueBtnText, isButtonDisabled() && styles.continueBtnTextDisabled]}>
                    {mode === 'signin' && (isAdminEmail ? 'Sign in as Admin' : 'Sign In')}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Link'}
                  </Text>
                  {!isButtonDisabled() && (
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.continueBtnIcon} />
                  )}
                </TouchableOpacity>
              </Animated.View>

              {__DEV__ && (
                <TouchableOpacity
                  style={styles.devBypassBtn}
                  onPress={() => {
                    login('dev-bypass@example.com', 'customer', 'Dev Bypass', 'individual');
                    router.replace('/');
                  }}
                >
                  <Text style={styles.devBypassBtnText}>DEV: Skip Login</Text>
                </TouchableOpacity>
              )}
            </View>


            {/* Mode Switcher */}
            <View style={styles.switchSection}>
              <Text style={styles.switchText}>
                {mode === 'forgot' 
                  ? 'Remember your password?' 
                  : mode === 'signin' 
                    ? "Don't have an account?" 
                    : 'Already have an account?'
                }
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (mode === 'forgot') {
                    handleModeChange('signin');
                  } else {
                    handleModeChange(mode === 'signin' ? 'signup' : 'signin');
                  }
                }}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <Text style={styles.switchLink}>
                  {mode === 'forgot' ? 'Sign In' : mode === 'signin' ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 14 },
  contentContainer: { paddingHorizontal: 20 },

  // Brand
  brandSection: { alignItems: 'center', marginBottom: 32 },
  brandGlow: {
    position: 'absolute',
    top: -22,
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: { position: 'absolute', borderRadius: 999 },
  glowRingOuter: {
    width: 130,
    height: 130,
    backgroundColor: '#0000000A',
  },
  glowRingInner: {
    width: 78,
    height: 78,
    backgroundColor: '#00000008',
  },

  // Mode Selector
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
    modeBtnActive: { backgroundColor: '#000000' },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
    modeBtnTextActive: { color: '#FFFFFF' },

  // Form
  formSection: { marginBottom: 14 },
  heading: { fontSize: 19, fontWeight: '800', color: '#000000', marginBottom: 3 },
  subtext: { fontSize: 13, color: '#6B6B6B', marginBottom: 12 },

  inputGroup: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: '#6B6B6B', marginBottom: 5, letterSpacing: 0.5 },
  inputWrapper: {
    backgroundColor: '#F6F6F6',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperFocused: {
    borderColor: '#000000',
    backgroundColor: '#F6F6F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapperError: { borderColor: '#E0393E' },
  input: { flex: 1, fontSize: 15, color: '#000000', paddingVertical: 0, height: 46 },
  fieldError: { color: '#E0393E', fontSize: 12, fontWeight: '600', marginTop: 5, marginLeft: 4 },
  helpText: { color: '#6B6B6B', fontSize: 12, marginTop: 6, marginLeft: 4 },

  // Auto-detected company banner (signup, work-email domain match)
  companyDetectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 4,
    gap: 6,
  },
  companyDetectedText: { color: '#6B6B6B', fontSize: 12, fontWeight: '600' },
  companyDetectedName: { color: '#1DA836', fontWeight: '800' },

  // Admin hint
  adminHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0DFA0',
    marginTop: 4,
  },
  adminHintIcon: { fontSize: 18, marginRight: 10 },
  adminHintText: { color: '#8A6D00', fontSize: 14, fontWeight: '700' },

  // Options
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  rememberContainer: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#B0B0B0',
    marginRight: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
    checkboxSelected: { backgroundColor: '#000000', borderColor: '#000000' },
  checkmark: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  rememberText: { fontSize: 13, color: '#6B6B6B' },
    forgotLink: { fontSize: 13, color: '#000000', fontWeight: '700', textDecorationLine: 'underline' },

  // Lock icon
  lockIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignSelf: 'center',
  },

  // Buttons
  continueBtn: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  },
  continueBtnDisabled: { backgroundColor: '#E0E0E0', shadowOpacity: 0 },
  continueBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  continueBtnTextDisabled: { color: '#9E9E9E' },
  continueBtnIcon: { marginLeft: 8 },
  devBypassBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0393E',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  devBypassBtnText: { color: '#E0393E', fontSize: 12, fontWeight: '700' },

  // Switch
  switchSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  switchText: { fontSize: 13, color: '#6B6B6B' },
    switchLink: { fontSize: 13, color: '#000000', fontWeight: '700', marginLeft: 6, textDecorationLine: 'underline' },

  // Footer
  footer: { alignItems: 'center' },
  footerText: { color: '#6B6B6B', fontSize: 12, textAlign: 'center', lineHeight: 18 },

});