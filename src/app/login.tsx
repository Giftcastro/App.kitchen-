import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated, View, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, useWindowDimensions, Modal,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
  import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import KitchenLogo from '../components/KitchenLogo';
import { Ionicons } from '@expo/vector-icons';
import { previewCompanyForEmail, CompanyPreview } from '../lib/supabase/auth';
import { listDeliveryLocations, DeliveryLocation } from '../lib/supabase/companies';
import { ThemeColors } from '../utils/theme';
import { haptics } from '../utils/haptics';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Builds a low-alpha rgba from a theme hex colour, so the login glow's
// brand-colour pop (see theme.brandPop) doesn't need its own light/dark hex
// pair hardcoded here on top of the one already in theme.ts.
const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export default function LoginScreen() {
  const { login, signInWithPassword, signUpWithPassword, theme, isDark } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Mode states
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Company is auto-detected from the email's domain (client's call) — no
  // manual override. Looked up live against the real company_domains table
  // (debounced, signup only) rather than any local list, so this preview
  // always matches what actually happens on submit. Only the delivery
  // *location* (see companyAddressId below) is a real user choice.
  const [rawMatchedCompany, setMatchedCompany] = useState<CompanyPreview | null>(null);
  useEffect(() => {
    const trimmed = email.trim();
    if (mode !== 'signup' || !EMAIL_REGEX.test(trimmed)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewCompanyForEmail(trimmed)
        .then(result => { if (!cancelled) setMatchedCompany(result); })
        .catch(() => { if (!cancelled) setMatchedCompany(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [email, mode]);
  // Gates the fetched result so a stale match never survives an email edit
  // or mode switch, without setting state synchronously from the effect
  // body above (a plain derived value instead — React only ever gets a
  // setState call from that effect's async callback).
  const matchedCompany = mode === 'signup' && EMAIL_REGEX.test(email.trim()) ? rawMatchedCompany : null;

  // A company employee whose employer has more than one registered address
  // picks which one they deliver to (see companyAddressId); individuals set
  // up their own delivery address afterwards from Profile. Null until the
  // picker is opened and something is chosen.
  const [companyAddressId, setCompanyAddressId] = useState<string | null>(null);
  // Resolved choice — falls back to the matched company's first registered
  // address so a single-site company (the common case) never requires an
  // extra tap, and a stale pick from a previously-matched company (the
  // email got edited) is never carried over onto a different one.
  const resolvedCompanyAddressId = useMemo(() => {
    if (!matchedCompany || matchedCompany.addresses.length === 0) return undefined;
    if (companyAddressId && matchedCompany.addresses.some(a => a.id === companyAddressId)) return companyAddressId;
    return matchedCompany.addresses[0].id;
  }, [matchedCompany, companyAddressId]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Individuals (no matched company) pick their delivery/collection point
  // from the businesses the client has registered, rather than typing their
  // own address (client review, Sep 2026: "we don't have control to where
  // deliveries will take place"). Fetched once, not per-keystroke like the
  // company preview above, since this list doesn't depend on the email.
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== 'signup' || deliveryLocations.length > 0) return;
    listDeliveryLocations().then(setDeliveryLocations).catch(() => setDeliveryLocations([]));
  }, [mode, deliveryLocations.length]);
  const selectedLocation = deliveryLocations.find(l => l.id === selectedLocationId) ?? null;

  // UI states
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; confirmPassword?: string; deliveryLocation?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  // Lazy useState, not useRef(new Animated.Value(x)).current: that form
  // built a throwaway Animated.Value on every render and read a ref during
  // render. useState guarantees the instance is created once and kept.
  const [btnScale] = useState(() => new Animated.Value(1));

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
  const brandMarginBottom = isCompactHeight ? 32 : 48;
  const sectionMarginBottom = isCompactHeight ? 10 : 14;

  const pressIn = () => {
    haptics.light();
    Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  };
  const pressOut = () => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  // Whether this submit is in flight — disables the button and swaps its
  // label so a slow connection can't be mistaken for the tap not registering.
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const newErrors: { email?: string; password?: string; name?: string; confirmPassword?: string; deliveryLocation?: string } = {};
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
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Individuals pick their delivery/collection point now instead of
    // setting it up later from Profile; company staff deliver to a
    // registered company address instead.
    if (!matchedCompany && !selectedLocationId) {
      newErrors.deliveryLocation = 'Please select a delivery location';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignin = async () => {
    if (!validateSignin()) { haptics.warning(); return; }
    setIsSubmitting(true);
    try {
      // Role/company are resolved server-side (real profiles.role, and a
      // re-check of the email's domain) — _layout's own redirect takes over
      // once the context's `user` is set, so there's nothing to do here on
      // success.
      await signInWithPassword(email.trim(), password);
    } catch (err) {
      haptics.warning();
      const message = String((err as { message?: string })?.message || '').toLowerCase();
      setErrors({
        password: message.includes('invalid login credentials')
          ? 'Incorrect email or password'
          : 'Sign-in failed — please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async () => {
    if (!validateSignup()) { haptics.warning(); return; }
    setIsSubmitting(true);
    try {
      // Whether this is a company account is driven entirely by the
      // work-email domain match — no manual override. Individuals' picked
      // delivery location is saved for real here (as their own address, with
      // its distance already known); company staff deliver to a registered
      // company address instead (their pick, if their employer has more
      // than one, is passed through as the preferred address).
      await signUpWithPassword(
        email.trim(),
        password,
        name.trim(),
        matchedCompany || !selectedLocation ? undefined : {
          label: selectedLocation.companyName,
          street: selectedLocation.unit ? `${selectedLocation.unit}, ${selectedLocation.street}` : selectedLocation.street,
          suburb: selectedLocation.suburb,
          city: selectedLocation.city,
          code: selectedLocation.code,
          distanceKm: selectedLocation.distanceKm ?? undefined,
        },
        matchedCompany ? resolvedCompanyAddressId : undefined
      );
    } catch (err) {
      haptics.warning();
      const message = String((err as { message?: string })?.message || '').toLowerCase();
      setErrors({
        email: message.includes('already registered') || message.includes('already exists')
          ? 'An account with this email already exists'
          : 'Sign-up failed — please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    if (email.trim() && EMAIL_REGEX.test(email.trim())) {
      // Simulate a password-reset email being sent — show a confirmation
      // instead of silently leaving the screen, so the user has some
      // indication the action actually did something.
      haptics.success();
      setForgotSubmitted(true);
    } else {
      haptics.warning();
      setErrors({ email: 'Please enter your email to reset password' });
    }
  };

  const handleModeChange = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode);
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setForgotSubmitted(false);
  };

    const renderSigninForm = () => (
    <>
      <View style={styles.inputGroup}>
        <View style={[styles.inputWrapper, focusedField === 'signinEmail' && styles.inputWrapperFocused, errors.email ? styles.inputWrapperError : null]}>
          <TextInput
            style={styles.input}
            placeholder="Email Address (e.g., alex@example.com)"
            placeholderTextColor={theme.textTertiary}
            value={email}
            onChangeText={(val) => { setEmail(val); if (errors.email) setErrors({ ...errors, email: undefined }); }}
            onFocus={() => setFocusedField('signinEmail')}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
            accessibilityLabel="Email address"
          />
        </View>
        {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <View style={[styles.inputWrapper, focusedField === 'signinPassword' && styles.inputWrapperFocused, errors.password ? styles.inputWrapperError : null]}>
          <TextInput
            style={styles.input}
            placeholder="Password (e.g., ••••••••)"
            placeholderTextColor={theme.textTertiary}
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
            accessibilityLabel="Password"
          />
                    <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={theme.textTertiary} style={{ paddingHorizontal: 6 }} />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
      </View>

      <View style={styles.optionsRow}>
        <TouchableOpacity
          style={styles.rememberContainer}
          onPress={() => setRememberMe(!rememberMe)}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityState={{ selected: rememberMe }}
          accessibilityLabel="Remember me"
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxSelected]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleModeChange('forgot')}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Forgot password?"
        >
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignupForm = () => (
    <>
      <View style={styles.inputGroup}>
        <View style={[styles.inputWrapper, focusedField === 'name' && styles.inputWrapperFocused, errors.name ? styles.inputWrapperError : null]}>
          <TextInput
            style={styles.input}
            placeholder="Full Name (e.g., John Doe)"
            placeholderTextColor={theme.textTertiary}
            value={name}
            onChangeText={(val) => { setName(val); if (errors.name) setErrors({ ...errors, name: undefined }); }}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            autoCorrect={false}
            autoComplete="name"
            returnKeyType="next"
            accessibilityLabel="Full name"
          />
        </View>
        {!!errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <View style={[styles.inputWrapper, focusedField === 'signupEmail' && styles.inputWrapperFocused, errors.email ? styles.inputWrapperError : null]}>
          <TextInput
            style={styles.input}
            placeholder="Email Address (e.g., john.doe@example.com)"
            placeholderTextColor={theme.textTertiary}
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (errors.email) setErrors({ ...errors, email: undefined });
              // A changed email can match a different company (or none) —
              // drop whatever delivery address was picked for the old one.
              setCompanyAddressId(null);
            }}
            onFocus={() => setFocusedField('signupEmail')}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
            accessibilityLabel="Email address"
          />
        </View>
        {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
        {/* Company is auto-detected by work-email domain — no manual
            picker, just this confirmation either way once the email looks
            like an email at all. A personal address (gmail.com etc.) is
            just as much a real, confirmed outcome as a company match — it
            shouldn't read as if nothing happened. */}
        {matchedCompany ? (
          <View style={styles.companyDetectedRow}>
            <Ionicons name="business" size={14} color={theme.success} />
            <Text style={styles.companyDetectedText}>
              Joining as <Text style={styles.companyDetectedName}>{matchedCompany.company_name}</Text>
            </Text>
          </View>
        ) : email.includes('@') ? (
          <View style={styles.companyDetectedRow}>
            <Ionicons name="person" size={14} color={theme.textSecondary} />
            <Text style={styles.companyDetectedText}>Joining as Individual</Text>
          </View>
        ) : null}
      </View>

      {/* Individuals pick which registered business they'll collect/deliver
          from, instead of typing their own address (client review, Sep
          2026) — company staff deliver to a registered company address
          (picked below when there's more than one) instead, so this is
          skipped entirely once a company match is found. */}
      {!matchedCompany && (
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={[styles.inputWrapper, styles.selectWrapper, errors.deliveryLocation ? styles.inputWrapperError : null]}
            onPress={() => { haptics.selection(); setShowLocationPicker(true); }}
            accessibilityRole="button"
            accessibilityLabel="Select your delivery location"
          >
            <Text style={[styles.selectValue, !selectedLocation && styles.selectPlaceholder]} numberOfLines={1}>
              {selectedLocation
                ? `${selectedLocation.companyName} — ${selectedLocation.street}, ${selectedLocation.suburb}`
                : 'Select your delivery location'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
          {errors.deliveryLocation && <Text style={styles.fieldError}>{errors.deliveryLocation}</Text>}
        </View>
      )}

      <View style={styles.inputGroup}>
        <View style={[styles.inputWrapper, focusedField === 'signupPassword' && styles.inputWrapperFocused, errors.password ? styles.inputWrapperError : null]}>
          <TextInput
            style={styles.input}
            placeholder="Password (min. 8 characters)"
            placeholderTextColor={theme.textTertiary}
            value={password}
            onChangeText={(val) => { setPassword(val); if (errors.password) setErrors({ ...errors, password: undefined }); }}
            onFocus={() => setFocusedField('signupPassword')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
                        returnKeyType="next"
            accessibilityLabel="Password"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={theme.textTertiary} style={{ paddingHorizontal: 6 }} />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused, errors.confirmPassword ? styles.inputWrapperError : null]}>
          <TextInput
            style={styles.input}
            placeholder="Confirm Password (match your password)"
            placeholderTextColor={theme.textTertiary}
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
            accessibilityLabel="Confirm password"
          />
        </View>
        {errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
      </View>

      {/* Company staff whose employer has more than one registered address
          pick which one they deliver to — anyone whose company only has one
          site (or whose email doesn't match a company at all) skips this
          entirely. */}
      {matchedCompany && matchedCompany.addresses.length > 1 && (
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={[styles.inputWrapper, styles.selectWrapper]}
            onPress={() => { haptics.selection(); setShowLocationPicker(true); }}
            accessibilityRole="button"
            accessibilityLabel="Select your delivery location"
          >
            <Text style={styles.selectValue} numberOfLines={1}>
              {(() => {
                const addr = matchedCompany.addresses.find(a => a.id === resolvedCompanyAddressId) ?? matchedCompany.addresses[0];
                return addr.label
                  ? addr.label
                  : `${addr.unit ? addr.unit + ', ' : ''}${addr.street}, ${addr.suburb}`;
              })()}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderForgotForm = () => {
    if (forgotSubmitted) {
      return (
        <View style={styles.lockIconContainer}>
          <Ionicons name="checkmark" size={26} color={theme.success} />
        </View>
      );
    }

    return (
      <>
        <View style={styles.lockIconContainer}>
          <Ionicons name="lock-closed" size={24} color={theme.text} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={[styles.inputWrapper, focusedField === 'forgotEmail' && styles.inputWrapperFocused, errors.email ? styles.inputWrapperError : null]}>
            <Ionicons name="mail-outline" size={16} color={focusedField === 'forgotEmail' ? theme.text : theme.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={theme.textTertiary}
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
              accessibilityLabel="Email address"
            />
          </View>
          {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}

          <Text style={styles.helpText}>
            We'll send you a link to reset your password
          </Text>
        </View>
      </>
    );
  };

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
    if (isSubmitting) return true;
    switch (mode) {
      case 'signin': return !email.trim() || !password;
      case 'signup': return !name.trim() || !email.trim() || !password || !confirmPassword;
      case 'forgot': return !email.trim() || !EMAIL_REGEX.test(email.trim());
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
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
              <KitchenLogo compact variant={isDark ? 'onDark' : 'onLight'} />
            </View>

            {/* Form. No Sign In/Sign Up tab selector above the form — the
                client's Sep 2026 reference (Nhlanhla's login mockup) drives
                mode entirely from the heading + the link at the bottom of
                the form instead, so this now matches that. */}
            <View style={[styles.formSection, { marginBottom: sectionMarginBottom }]}>
              {mode !== 'signin' && (
                <Text style={styles.heading}>
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && (forgotSubmitted ? 'Check your email' : 'Reset your password')}
                </Text>
              )}
              <Text style={[styles.subtext, mode === 'signin' && styles.subtextStandalone]}>
                {mode === 'signin' && 'Sign in to continue'}
                {mode === 'signup' && 'Join Kitchen Co. today'}
                {mode === 'forgot' && (forgotSubmitted
                  ? `If an account exists for ${email.trim()}, we've sent a link to reset your password.`
                  : 'Enter your email to receive reset instructions')}
              </Text>

              {renderContent()}

              {!(mode === 'forgot' && forgotSubmitted) && (
                <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                  <TouchableOpacity
                    style={[styles.continueBtn, isButtonDisabled() && styles.continueBtnDisabled]}
                    onPress={handleSubmit}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    activeOpacity={0.9}
                    disabled={isButtonDisabled()}
                    accessibilityRole="button"
                    accessibilityLabel={
                      mode === 'signin' ? 'Sign In'
                        : mode === 'signup' ? 'Get Started'
                        : 'Send Reset Link'
                    }
                    accessibilityState={{ disabled: isButtonDisabled() }}
                  >
                    {mode === 'signin' && (
                      <Ionicons name="lock-closed" size={16} color={theme.onAccent} style={styles.continueBtnLeadIcon} />
                    )}
                    {mode === 'signup' && (
                      <Ionicons name="rocket" size={16} color={theme.onAccent} style={styles.continueBtnLeadIcon} />
                    )}
                    <Text style={[styles.continueBtnText, isButtonDisabled() && styles.continueBtnTextDisabled]}>
                      {mode === 'signin' && (isSubmitting ? 'SIGNING IN…' : 'SECURE LOGIN')}
                      {mode === 'signup' && (isSubmitting ? 'CREATING ACCOUNT…' : 'GET STARTED')}
                      {mode === 'forgot' && 'Send Reset Link'}
                    </Text>
                    {mode === 'forgot' && !isButtonDisabled() && (
                      <Ionicons name="arrow-forward" size={18} color={theme.onAccent} style={styles.continueBtnIcon} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
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
                accessibilityRole="button"
                accessibilityLabel={mode === 'forgot' ? 'Sign In' : mode === 'signin' ? 'Sign Up' : 'Sign In'}
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

      {/* Delivery-site picker. Two independent uses, never both at once
          (matchedCompany and the individual flow are mutually exclusive):
          company staff pick among their own employer's registered addresses
          (matchedCompany.addresses — client request, Sep 2026: "one company
          can have many addresses"); individuals instead pick their
          collection point from every business/delivery address the client
          has registered (deliveryLocations, client review, Sep 2026: "we
          don't have control to where deliveries will take place"), so each
          row also shows which business it belongs to. Company itself is
          never picked here either way — it's auto-detected by email domain. */}
      <Modal visible={showLocationPicker} animationType="slide" transparent onRequestClose={() => setShowLocationPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowLocationPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Select your delivery location</Text>
            <ScrollView style={styles.pickerList}>
              {matchedCompany ? matchedCompany.addresses.map(addr => (
                <TouchableOpacity
                  key={addr.id}
                  style={styles.pickerRow}
                  onPress={() => { haptics.selection(); setCompanyAddressId(addr.id); setShowLocationPicker(false); }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: resolvedCompanyAddressId === addr.id }}
                >
                  <View style={styles.pickerRowIconWrap}>
                    <Ionicons name="location" size={16} color={theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {!!addr.label && <Text style={styles.pickerRowText} numberOfLines={1}>{addr.label}</Text>}
                    <Text style={[styles.pickerRowSubtext, !addr.label && styles.pickerRowText]} numberOfLines={1}>
                      {addr.unit ? `${addr.unit}, ` : ''}{addr.street}, {addr.suburb}
                    </Text>
                  </View>
                  {resolvedCompanyAddressId === addr.id && (
                    <View style={styles.pickerCheckBadge}>
                      <Ionicons name="checkmark" size={13} color={theme.onAccent} />
                    </View>
                  )}
                </TouchableOpacity>
              )) : deliveryLocations.map(loc => (
                <TouchableOpacity
                  key={loc.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    haptics.selection();
                    setSelectedLocationId(loc.id);
                    if (errors.deliveryLocation) setErrors({ ...errors, deliveryLocation: undefined });
                    setShowLocationPicker(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedLocationId === loc.id }}
                >
                  <View style={styles.pickerRowIconWrap}>
                    <Ionicons name="business" size={16} color={theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerRowText} numberOfLines={1}>{loc.companyName}</Text>
                    <Text style={styles.pickerRowSubtext} numberOfLines={1}>
                      {loc.unit ? `${loc.unit}, ` : ''}{loc.street}, {loc.suburb}
                    </Text>
                  </View>
                  {selectedLocationId === loc.id && (
                    <View style={styles.pickerCheckBadge}>
                      <Ionicons name="checkmark" size={13} color={theme.onAccent} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {!matchedCompany && deliveryLocations.length === 0 && (
                <Text style={styles.pickerEmptyText}>No delivery locations are available yet — please check back soon.</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowLocationPicker(false)} accessibilityRole="button">
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
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
  // The client's CI-colour "pop" (client review, Sep 2026, repeated
  // 2026-09-15) — this glow was plain black-tinted before; everything else
  // on this screen, including the primary button, stays black/white.
  glowRingOuter: {
    width: 130,
    height: 130,
    backgroundColor: withAlpha(theme.brandPop, 0.05),
  },
  glowRingInner: {
    width: 78,
    height: 78,
    backgroundColor: withAlpha(theme.brandPop, 0.09),
  },

  // Form
  formSection: { marginBottom: 14 },
  heading: { fontSize: 19, fontWeight: '800', color: theme.text, marginBottom: 3 },
  subtext: { fontSize: 13, color: theme.textSecondary, marginBottom: 12 },
  // Sign-in has no bold heading above it (client reference, Sep 2026) — this
  // line stands alone as the screen's only caption, so it reads centered
  // rather than as a left-aligned subtitle under a heading that isn't there.
  subtextStandalone: { textAlign: 'center', marginBottom: 54 },

  inputGroup: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 5, letterSpacing: 0.5 },
  inputWrapper: {
    backgroundColor: theme.inputBg,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperFocused: {
    borderColor: theme.text,
    backgroundColor: theme.inputBg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapperError: { borderColor: theme.error },
  input: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 0, height: 46 },
  fieldError: { color: theme.error, fontSize: 12, fontWeight: '600', marginTop: 5, marginLeft: 4 },
  helpText: { color: theme.textSecondary, fontSize: 12, marginTop: 6, marginLeft: 4 },
  // Auto-detected company confirmation (signup, work-email domain match)
  companyDetectedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4, gap: 6 },
  companyDetectedText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  companyDetectedName: { color: theme.success, fontWeight: '800' },

  // "Select your company" / "Select your delivery location" — styled like
  // the other inputWrapper fields plus a chevron, opening pickerSheet below.
  selectWrapper: { justifyContent: 'space-between' },
  selectValue: { flex: 1, fontSize: 15, color: theme.text },
  selectPlaceholder: { color: theme.textTertiary },
  pickerOverlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    maxHeight: '60%',
  },
  // Small drag-handle bar, purely decorative — signals "this sheet can be
  // dismissed" without adding a close button next to the title.
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  pickerTitle: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, paddingHorizontal: 4 },
  // Fixed cap (not just the sheet's own maxHeight) so this actually scrolls
  // once the individual-flow list (every registered business, not just one
  // company's handful of sites) outgrows the sheet, instead of overflowing
  // past it uncontained — a plain View has no intrinsic scroll bound here.
  pickerList: { flexGrow: 0, maxHeight: 320 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  pickerRowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRowText: { flex: 1, fontSize: 14, color: theme.text, fontWeight: '600' },
  pickerRowSubtext: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  pickerCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  pickerCancelText: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  pickerEmptyText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', paddingVertical: 20 },

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
    borderColor: theme.textTertiary,
    marginRight: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
    checkboxSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
  checkmark: { color: theme.onAccent, fontSize: 11, fontWeight: '700' },
  rememberText: { fontSize: 13, color: theme.textSecondary },
    forgotLink: { fontSize: 13, color: theme.text, fontWeight: '700', textDecorationLine: 'underline' },

  // Lock icon
  lockIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    alignSelf: 'center',
  },

  // Buttons. Pill-shaped (client reference, Sep 2026) — kept in the app's
  // existing black/white accent rather than the blue in that reference,
  // which was the brand-blue trialled and superseded earlier (see
  // utils/theme.ts) by the client's own "keep it black and white" call.
  continueBtn: {
    flexDirection: 'row',
    backgroundColor: theme.accent,
    paddingVertical: 15,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  },
  continueBtnDisabled: { backgroundColor: theme.border, shadowOpacity: 0 },
  continueBtnText: { color: theme.onAccent, fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  continueBtnTextDisabled: { color: theme.textTertiary },
  continueBtnIcon: { marginLeft: 8 },
  continueBtnLeadIcon: { marginRight: 8 },

  // Switch
  switchSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  switchText: { fontSize: 13, color: theme.textSecondary },
    switchLink: { fontSize: 13, color: theme.text, fontWeight: '700', marginLeft: 6, textDecorationLine: 'underline' },

  // Footer
  footer: { alignItems: 'center' },
  footerText: { color: theme.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },

});
