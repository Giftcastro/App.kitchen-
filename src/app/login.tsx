import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar, SafeAreaView,
  ScrollView
} from 'react-native';
import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_EMAIL = 'admin@kitchenco.com';

export default function LoginScreen() {
  const { login } = useKitchen();
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState<'individual' | 'company'>('individual');
  const [companyName, setCompanyName] = useState('');
  
  // Mode states
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  
  // UI states
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; confirmPassword?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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
      login(email.trim(), role, undefined, undefined, undefined);
      router.replace('/');
    }
  };

  const handleSignup = () => {
    if (validateSignup()) {
      const role = isAdminEmail ? 'admin' : 'customer';
      login(email.trim(), role, name.trim(), accountType, accountType === 'company' ? companyName.trim() : undefined);
      router.replace('/');
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
        <View style={[styles.inputWrapper, errors.email ? styles.inputWrapperError : null]}>
          <Text style={styles.inputIcon}>✉️</Text>
          <TextInput
            style={styles.input}
            placeholder="name@gmail.com"
            placeholderTextColor="#6B6B6B"
            value={email}
            onChangeText={(val) => { setEmail(val); if (errors.email) setErrors({ ...errors, email: undefined }); }}
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
        <View style={[styles.inputWrapper, errors.password ? styles.inputWrapperError : null]}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#6B6B6B"
            value={password}
            onChangeText={(val) => { setPassword(val); if (errors.password) setErrors({ ...errors, password: undefined }); }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleSignin}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.passwordToggle}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
      </View>

      <View style={styles.optionsRow}>
        <TouchableOpacity 
          style={styles.rememberContainer} 
          onPress={() => setRememberMe(!rememberMe)}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxSelected]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => handleModeChange('forgot')}>
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignupForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>FULL NAME</Text>
        <View style={[styles.inputWrapper, errors.name ? styles.inputWrapperError : null]}>
          <Text style={styles.inputIcon}>👤</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#6B6B6B"
            value={name}
            onChangeText={(val) => { setName(val); if (errors.name) setErrors({ ...errors, name: undefined }); }}
            autoCorrect={false}
            autoComplete="name"
            returnKeyType="next"
          />
        </View>
        {errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
      </View>

      {/* Account Type: Individual or Company */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>ACCOUNT TYPE</Text>
        <View style={styles.accountTypeRow}>
          <TouchableOpacity
            style={[styles.accountTypeBtn, accountType === 'individual' && styles.accountTypeBtnActive]}
            onPress={() => setAccountType('individual')}
          >
            <Text style={styles.accountTypeIcon}>👤</Text>
            <Text style={[styles.accountTypeText, accountType === 'individual' && styles.accountTypeTextActive]}>Individual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.accountTypeBtn, accountType === 'company' && styles.accountTypeBtnActive]}
            onPress={() => setAccountType('company')}
          >
            <Text style={styles.accountTypeIcon}>🏢</Text>
            <Text style={[styles.accountTypeText, accountType === 'company' && styles.accountTypeTextActive]}>Company</Text>
          </TouchableOpacity>
        </View>
      </View>

      {accountType === 'company' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>COMPANY NAME</Text>
          <View style={[styles.inputWrapper]}>
            <Text style={styles.inputIcon}>🏢</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ABC Corp"
              placeholderTextColor="#6B6B6B"
              value={companyName}
              onChangeText={(val) => setCompanyName(val)}
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={[styles.inputWrapper, errors.email ? styles.inputWrapperError : null]}>
          <Text style={styles.inputIcon}>✉️</Text>
          <TextInput
            style={styles.input}
            placeholder="name@gmail.com"
            placeholderTextColor="#6B6B6B"
            value={email}
            onChangeText={(val) => { setEmail(val); if (errors.email) setErrors({ ...errors, email: undefined }); }}
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
        <View style={[styles.inputWrapper, errors.password ? styles.inputWrapperError : null]}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="Create a password"
            placeholderTextColor="#6B6B6B"
            value={password}
            onChangeText={(val) => { setPassword(val); if (errors.password) setErrors({ ...errors, password: undefined }); }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            returnKeyType="next"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.passwordToggle}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={[styles.inputWrapper, errors.confirmPassword ? styles.inputWrapperError : null]}>
          <Text style={styles.inputIcon}>🔐</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#6B6B6B"
            value={confirmPassword}
            onChangeText={(val) => { setConfirmPassword(val); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined }); }}
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
        <Text style={styles.lockIcon}>🔐</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={[styles.inputWrapper, errors.email ? styles.inputWrapperError : null]}>
          <Text style={styles.inputIcon}>✉️</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#6B6B6B"
            value={email}
            onChangeText={(val) => { setEmail(val); if (errors.email) setErrors({ ...errors, email: undefined }); }}
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
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>
            {/* Brand */}
            <View style={styles.brandSection}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>K</Text>
              </View>
              <Text style={styles.brandName}>Kitchen Co.</Text>
              <Text style={styles.brandTagline}>Delicious meals, delivered fast</Text>
              <View style={styles.brandHighlight} />
            </View>

            {/* Mode Selector */}
            <View style={styles.modeSelector}>
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
            <View style={styles.formSection}>
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

              <TouchableOpacity
                style={[styles.continueBtn, isButtonDisabled() && styles.continueBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.9}
                disabled={isButtonDisabled()}
              >
                <Text style={[styles.continueBtnText, isButtonDisabled() && styles.continueBtnTextDisabled]}>
                  {mode === 'signin' && (isAdminEmail ? 'Sign in as Admin' : 'Sign In')}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </Text>
              </TouchableOpacity>
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
  safeArea: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  contentContainer: { paddingHorizontal: 24 },
  
  // Brand
  brandSection: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16,
    shadowColor: '#5AC8FA',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 15,
  },
  logoText: { fontSize: 44, fontWeight: '900', color: '#000000', letterSpacing: -1 },
  brandName: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, marginBottom: 4 },
  brandTagline: { fontSize: 15, color: '#8E8E93', fontWeight: '600' },
  brandHighlight: { 
    width: 120, 
    height: 4, 
    backgroundColor: '#5AC8FA', 
    borderRadius: 2, 
    marginTop: 8,
  },

  // Mode Selector
  modeSelector: { 
    flexDirection: 'row', 
    backgroundColor: '#1E1E1E', 
    borderRadius: 16, 
    padding: 4, 
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  modeBtn: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: 12, 
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#FFFFFF' },
  modeBtnText: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#6B6B6B',
  },
  modeBtnTextActive: { color: '#000000' },

  // Form
  formSection: { marginBottom: 24 },
  heading: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  subtext: { fontSize: 14, color: '#6B6B6B', marginBottom: 20 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B6B6B', marginBottom: 8, letterSpacing: 0.5 },
  inputWrapper: { 
    backgroundColor: '#1E1E1E', 
    borderWidth: 1.5, 
    borderColor: '#2C2C2E', 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperError: { borderColor: '#FF453A' },
  inputIcon: { fontSize: 18, marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#FFFFFF', paddingVertical: 0, height: 54 },
  passwordToggle: { fontSize: 18, paddingHorizontal: 8 },
  fieldError: { color: '#FF453A', fontSize: 12, fontWeight: '600', marginTop: 6, marginLeft: 4 },
  helpText: { color: '#6B6B6B', fontSize: 12, marginTop: 8, marginLeft: 4 },

  // Account Type
  accountTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  accountTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
  },
  accountTypeBtnActive: {
    borderColor: '#5AC8FA',
    backgroundColor: '#1A2A3A',
  },
  accountTypeIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  accountTypeText: {
    color: '#6B6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  accountTypeTextActive: {
    color: '#5AC8FA',
  },

  // Admin hint
  adminHint: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#2C1F00', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#5A4600',
    marginTop: 8,
  },
  adminHintIcon: { fontSize: 18, marginRight: 10 },
  adminHintText: { color: '#FFD60A', fontSize: 14, fontWeight: '700' },

  // Options
  optionsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
    marginTop: 4,
  },
  rememberContainer: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { 
    width: 20, 
    height: 20, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: '#6B6B6B', 
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: '#5AC8FA', borderColor: '#5AC8FA' },
  checkmark: { color: '#000000', fontSize: 12, fontWeight: '700' },
  rememberText: { fontSize: 14, color: '#6B6B6B' },
  forgotLink: { fontSize: 14, color: '#5AC8FA', fontWeight: '600' },

  // Lock icon
  lockIconContainer: { alignItems: 'center', marginVertical: 16 },
  lockIcon: { fontSize: 48 },

  // Buttons
  continueBtn: { 
    backgroundColor: '#FFFFFF', 
    paddingVertical: 16, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginTop: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  continueBtnDisabled: { backgroundColor: '#2C2C2E' },
  continueBtnText: { color: '#000000', fontSize: 16, fontWeight: '800' },
  continueBtnTextDisabled: { color: '#6B6B6B' },

  // Switch
  switchSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  switchText: { fontSize: 14, color: '#6B6B6B' },
  switchLink: { fontSize: 14, color: '#5AC8FA', fontWeight: '600', marginLeft: 6 },

  // Footer
  footer: { alignItems: 'center' },
  footerText: { color: '#6B6B6B', fontSize: 12, textAlign: 'center', lineHeight: 18 },

});