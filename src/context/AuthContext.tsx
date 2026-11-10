import { OTP_LENGTH } from '../utils/authSecurity';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { UserProfile, UserRole } from '../types';
import { WHITELISTED_COMPANY_DOMAINS, MOCK_USER_PROFILE } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportError } from '../services/errorReporting';

const INCOMPLETE_REGISTRATION_MESSAGE =
  'Your registration is not finished. Please sign up with this email to complete it.';

const hasCompletedRegistration = (profile: any): boolean =>
  Boolean(profile && (profile.company_id || profile.role === 'admin' || profile.role === 'chef'));

const AUTH_STORAGE_KEY = '@kitchen_co_user_profile';

interface AuthContextType {
  currentUser: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  domainError: string | null;
  otpSentEmail: string | null;
  pendingOtpData: { email: string; phone?: string } | null;
  pendingOAuthUser: { id: string; email: string; fullName: string; provider?: string } | null;
  isPasswordModalVisible: boolean;
  isPasswordRecoveryMode: boolean;
  recoveryEmail: string;
  verifyDomainAndSendOtp: (email: string, phoneNumber?: string) => Promise<boolean>;
  sendPin: (email: string) => Promise<boolean>;
  verifyPin: (email: string, pin: string) => Promise<boolean>;
  simulateSignUp: (email: string) => Promise<boolean>;
  completeRegistration: (data: {
    fullName: string;
    password: string;
    companyId: string;
    companyName: string;
    locationName: string;
    buildingName?: string;
    deliveryFloor?: string;
    phoneNumber: string;
    email: string;
  }) => Promise<UserProfile>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signInWithSocial: (provider: 'google' | 'apple') => Promise<boolean>;
  simulateSignIn: (role?: UserRole) => Promise<void>;
  setPasswordAndCompleteProfile: (password: string, fullName?: string, phoneNumber?: string) => Promise<boolean>;
  updateDropoffFloor: (newFloor: string) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setMockRole: (role: UserRole) => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<boolean>;
  resetUserPassword: (newPassword: string) => Promise<boolean>;
  clearPasswordRecoveryMode: () => void;
  clearPendingOAuthUser: () => void;
  signOut: () => Promise<void>;
  clearErrors: () => void;
  openPasswordModalForPendingUser: () => void;
  closePasswordModal: () => void;
  hasPromptedDeliveryDate: boolean;
  markDeliveryDatePrompted: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Helper to parse query and hash parameters from a deep link or web URL
 * (e.g. kitchenco://reset-password#access_token=...&refresh_token=...&type=recovery)
 */
const parseAuthUrlParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  try {
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');

    const segments: string[] = [];
    if (queryIndex !== -1) {
      const end = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
      segments.push(url.substring(queryIndex + 1, end));
    }
    if (hashIndex !== -1) {
      segments.push(url.substring(hashIndex + 1));
    }

    segments.forEach((seg) => {
      seg.split('&').forEach((pair) => {
        const [rawKey, rawVal] = pair.split('=');
        if (rawKey && rawVal !== undefined) {
          params[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal);
        }
      });
    });
  } catch (err) {
    console.warn('Failed to parse auth URL params:', err);
  }
  return params;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [otpSentEmail, setOtpSentEmail] = useState<string | null>(null);
  const [pendingOtpData, setPendingOtpData] = useState<{ email: string; phone?: string } | null>(null);
  const [pendingOAuthUser, setPendingOAuthUser] = useState<{
    id: string;
    email: string;
    fullName: string;
    provider?: string;
  } | null>(null);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState<boolean>(false);
  const [hasPromptedDeliveryDate, setHasPromptedDeliveryDate] = useState<boolean>(false);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [failedPinAttempts, setFailedPinAttempts] = useState<number>(0);
  const [pinLockoutUntil, setPinLockoutUntil] = useState<number>(0);

  const markDeliveryDatePrompted = useCallback(() => {
    setHasPromptedDeliveryDate(true);
  }, []);

  const clearPasswordRecoveryMode = useCallback(() => {
    setIsPasswordRecoveryMode(false);
  }, []);

  const clearPendingOAuthUser = useCallback(() => {
    setPendingOAuthUser(null);
  }, []);

  const isLegacyDummyProfile = (profile: Partial<UserProfile> | null | undefined): boolean => {
    if (!profile) return false;
    const id = String(profile.id || '');
    const email = String(profile.email || '').toLowerCase();
    return (
      id.startsWith('usr_google_') ||
      id.startsWith('usr_apple_') ||
      id.startsWith('usr_demo_') ||
      id === 'usr_admin_demo' ||
      email === 'alex.google@example.com' ||
      email === 'alex.apple@example.com' ||
      email === 'demo.customer@example.com'
    );
  };

  const hydrateFromSupabaseSessionUser = useCallback(
    async (sbUser: any, isFromOAuthOrCallback: boolean = false) => {
      if (!sbUser?.id || !isSupabaseConfigured()) return;

      const cleanEmail = (sbUser.email || '').trim().toLowerCase();
      const domain = cleanEmail.includes('@') ? cleanEmail.split('@')[1] : '';
      const matchedCompany =
        WHITELISTED_COMPANY_DOMAINS.find(
          (c) => c.domain.toLowerCase() === domain.toLowerCase() && c.isActive
        ) || WHITELISTED_COMPANY_DOMAINS[0];

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*, companies(name)')
        .eq('id', sbUser.id)
        .maybeSingle();

      const provider =
        sbUser.app_metadata?.provider ||
        (Array.isArray(sbUser.app_metadata?.providers)
          ? sbUser.app_metadata.providers.find((p: string) => p === 'google' || p === 'apple')
          : undefined);

      const isOAuthAccount = provider === 'google' || provider === 'apple' || isFromOAuthOrCallback;
      const hasCompletedProfile = hasCompletedRegistration(profileData);

      if (hasCompletedProfile) {
        const companyName = profileData?.companies?.name || matchedCompany.companyName;
        const extractedName =
          profileData?.full_name ||
          sbUser.user_metadata?.full_name ||
          sbUser.user_metadata?.name ||
          cleanEmail.split('@')[0].replace('.', ' ');

        const userProfile: UserProfile = {
          id: sbUser.id,
          email: cleanEmail,
          fullName: extractedName,
          phoneNumber: profileData?.phone_number || '',
          role: (profileData?.role as UserRole) || 'user',
          companyId: profileData?.company_id || matchedCompany.id,
          companyName,
          locationName: profileData?.location_name || matchedCompany.locationName,
          buildingName: profileData?.building_name || matchedCompany.buildingName,
          deliveryFloor:
            profileData?.delivery_floor || matchedCompany.deliveryFloor || 'Floor 3 (Reception Pantry)',
          createdAt: profileData?.created_at || new Date().toISOString(),
        };

        setPendingOAuthUser(null);
        setCurrentUser(userProfile);
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
      } else if (isOAuthAccount) {
        // New Google/Apple OAuth user: only collect their Full Name & Email and pre-populate "Complete Your Profile"
        const extractedFullName = (
          profileData?.full_name ||
          sbUser.user_metadata?.full_name ||
          sbUser.user_metadata?.name ||
          ''
        ).trim();

        setCurrentUser(null);
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        setOtpSentEmail(cleanEmail);
        setPendingOtpData({ email: cleanEmail });
        setPendingOAuthUser({
          id: sbUser.id,
          email: cleanEmail,
          fullName: extractedFullName,
          provider: provider || 'google',
        });
      } else if (!profileErr) {
        // Drops a profile cached by an older build whose registration never saved.
        setCurrentUser(null);
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      }
    },
    []
  );

  // Restore stored session on mount & listen for password recovery / OAuth deep links & auth events
  useEffect(() => {
    const restoreSession = async () => {
      try {
        let isRecoveryUrl = false;
        let isOAuthCallbackUrl = false;

        // Check if app was opened via a password reset link or OAuth callback on web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const fullUrl = window.location.href;
          const pathname = window.location.pathname.toLowerCase();
          if (fullUrl.includes('type=recovery') || pathname.includes('reset-password')) {
            isRecoveryUrl = true;
            setIsPasswordRecoveryMode(true);
          }
          if (
            pathname.includes('/auth/callback') ||
            fullUrl.includes('code=') ||
            fullUrl.includes('access_token=')
          ) {
            isOAuthCallbackUrl = true;
          }
        }

        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsedProfile = JSON.parse(stored);
          if (isLegacyDummyProfile(parsedProfile)) {
            await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          } else if (!isRecoveryUrl) {
            setCurrentUser(parsedProfile);
          }
        }

        if (isSupabaseConfigured() && !isRecoveryUrl) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            await hydrateFromSupabaseSessionUser(session.user, isOAuthCallbackUrl);
          }
        }
      } catch (err) {
        console.warn('Error restoring session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Handle incoming deep links (kitchenco://reset-password, kitchenco://auth/callback, or Expo Go)
    const handleDeepLinkUrl = async (url: string | null) => {
      if (!url) return;
      const isRecoveryLink =
        url.includes('reset-password') ||
        url.includes('type=recovery');
      const isOAuthCallback =
        url.includes('auth/callback') ||
        url.includes('auth-callback');

      if (!isRecoveryLink && !isOAuthCallback) return;

      const params = parseAuthUrlParams(url);
      if (isSupabaseConfigured()) {
        try {
          let sessionUser: any = null;
          if (params.access_token && params.refresh_token) {
            const { data } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });
            sessionUser = data?.user;
          } else if (params.token_hash && isRecoveryLink) {
            const { data } = await supabase.auth.verifyOtp({
              token_hash: params.token_hash,
              type: 'recovery',
            });
            sessionUser = data?.user;
          } else if (params.code) {
            const { data } = await supabase.auth.exchangeCodeForSession(params.code);
            sessionUser = data?.user;
          }

          if (isRecoveryLink) {
            if (sessionUser?.email) {
              setRecoveryEmail(sessionUser.email);
            }
            setCurrentUser(null);
            setIsPasswordRecoveryMode(true);
            return;
          }

          if (isOAuthCallback && sessionUser) {
            await hydrateFromSupabaseSessionUser(sessionUser, true);
            return;
          }
        } catch (err) {
          console.warn('Error hydrating session from deep link:', err);
        }
      }

      if (isRecoveryLink) {
        setCurrentUser(null);
        setIsPasswordRecoveryMode(true);
      }
    };

    Linking.getInitialURL().then(handleDeepLinkUrl).catch(() => {});
    const linkSub = Linking.addEventListener('url', (event) => {
      handleDeepLinkUrl(event.url);
    });

    // Listen for Supabase PASSWORD_RECOVERY and SIGNED_IN events (including Google/Apple OAuth redirect)
    let authSub: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          if (session?.user?.email) {
            setRecoveryEmail(session.user.email);
          }
          setCurrentUser(null);
          setIsPasswordRecoveryMode(true);
        } else if (event === 'SIGNED_IN' && session?.user) {
          const provider = session.user.app_metadata?.provider;
          const isSocial = provider === 'google' || provider === 'apple';
          const isCallbackPath =
            Platform.OS === 'web' &&
            typeof window !== 'undefined' &&
            window.location.pathname.toLowerCase().includes('/auth/callback');

          if (isSocial || isCallbackPath) {
            hydrateFromSupabaseSessionUser(session.user, true).catch((e) =>
              console.warn('OAuth hydration notice:', e)
            );
          }
        }
      });
      authSub = data.subscription;
    }

    return () => {
      linkSub.remove();
      if (authSub) authSub.unsubscribe();
    };
  }, [hydrateFromSupabaseSessionUser]);

  const clearErrors = useCallback(() => {
    setError(null);
    setDomainError(null);
  }, []);

  const extractDomain = (email: string): string => {
    const parts = email.trim().toLowerCase().split('@');
    return parts.length === 2 ? parts[1] : '';
  };

  const checkDomainWhitelist = (domain: string) => {
    return WHITELISTED_COMPANY_DOMAINS.find(
      (c) => c.domain.toLowerCase() === domain.toLowerCase() && c.isActive
    );
  };

  const sendPin = async (email: string): Promise<boolean> => {
    clearErrors();
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setError('Please enter a valid personal or corporate email address.');
        setIsLoading(false);
        return false;
      }

      if (!isSupabaseConfigured()) {
        setError('Authentication service is not configured.');
        setIsLoading(false);
        return false;
      }

      const redirectUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/auth/verify`
          : Linking.createURL('auth/verify');

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectUrl,
        },
      });

      if (otpError) {
        console.warn('Supabase signInWithOtp notice:', otpError.message);
        setError(otpError.message || 'Could not send 8-digit PIN to your email.');
        setIsLoading(false);
        return false;
      }

      setOtpSentEmail(cleanEmail);
      setPendingOtpData({ email: cleanEmail });
      setFailedPinAttempts(0);
      setPinLockoutUntil(0);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Could not dispatch 8-digit PIN.');
      setIsLoading(false);
      return false;
    }
  };

  const verifyPin = async (email: string, pin: string): Promise<boolean> => {
    clearErrors();

    const now = Date.now();
    if (pinLockoutUntil > now) {
      const remainingSeconds = Math.ceil((pinLockoutUntil - now) / 1000);
      setError(`Too many failed PIN attempts. Please wait ${remainingSeconds}s before trying again.`);
      return false;
    }

    setIsLoading(true);
    try {
      const cleanPin = pin.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (cleanPin.length !== OTP_LENGTH || !/^\d+$/.test(cleanPin)) {
        setError(`Verification PIN must be exactly ${OTP_LENGTH} numeric digits.`);
        setIsLoading(false);
        return false;
      }

      if (isSupabaseConfigured()) {
        try {
          const { data: verified, error: verifyErr } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanPin,
            type: 'email',
          });
          if (!verifyErr) {
            setFailedPinAttempts(0);
            setPinLockoutUntil(0);
            // A returning customer who proved their email goes straight in.
            await hydrateFromSupabaseSessionUser(verified.user);
            setIsLoading(false);
            return true;
          }

          // Fallback check if token was issued under 'signup' OTP type
          const { data: verifiedSignup, error: signupVerifyErr } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanPin,
            type: 'signup',
          });
          if (!signupVerifyErr) {
            setFailedPinAttempts(0);
            setPinLockoutUntil(0);
            await hydrateFromSupabaseSessionUser(verifiedSignup.user);
            setIsLoading(false);
            return true;
          }
        } catch (e) {
          console.warn('Supabase verifyOtp notice:', e);
        }
      }

      const nextAttempts = failedPinAttempts + 1;
      setFailedPinAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setPinLockoutUntil(Date.now() + 60_000);
        setError('Too many failed PIN attempts. Verification locked for 60 seconds.');
      } else {
        setError('The 8-digit PIN entered is incorrect or expired. Please check your inbox or tap Resend.');
      }
      setIsLoading(false);
      return false;
    } catch (err: any) {
      setError(err.message || 'Error verifying PIN.');
      setIsLoading(false);
      return false;
    }
  };

  const simulateSignUp = async (email: string): Promise<boolean> => {
    clearErrors();
    const cleanEmail = email.trim().toLowerCase();
    setOtpSentEmail(cleanEmail);
    setPendingOtpData({ email: cleanEmail });
    return true;
  };

  const completeRegistration = async (data: {
    fullName: string;
    password: string;
    companyId: string;
    companyName: string;
    locationName: string;
    buildingName?: string;
    deliveryFloor?: string;
    phoneNumber: string;
    email: string;
  }): Promise<UserProfile> => {
    clearErrors();
    setIsLoading(true);

    try {
      const cleanEmail = (data.email || pendingOAuthUser?.email || '').trim().toLowerCase();
      const isUuid = (val?: string) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      if (!isSupabaseConfigured()) {
        throw new Error('Authentication service is not configured.');
      }
      if (!isUuid(data.companyId)) {
        throw new Error('Your company could not be confirmed. Please go back and choose it again.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resolvedUserId = session?.user?.id;
      if (!resolvedUserId) {
        throw new Error('Your verification has expired. Please sign up again.');
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: data.password,
        data: {
          full_name: data.fullName.trim(),
          company_id: data.companyId,
          company_name: data.companyName,
          location_name: data.locationName,
          delivery_floor: data.deliveryFloor || null,
          phone_number: data.phoneNumber,
        },
      });

      // Retrying after a failed save sends the same password, which Supabase rejects.
      const isSamePassword =
        updateErr?.code === 'same_password' || /different from the old password/i.test(updateErr?.message || '');
      if (updateErr && !isSamePassword) {
        throw new Error(updateErr.message);
      }

      // Nobody enters the app unless this save succeeds.
      const { error: saveErr } = await supabase.from('profiles').upsert(
        {
          id: resolvedUserId,
          email: cleanEmail,
          full_name: data.fullName.trim(),
          role: 'user',
          company_id: data.companyId,
          location_name: data.locationName,
          building_name: data.buildingName || data.locationName,
          // Empty means the database picks the site's default drop-off.
          delivery_floor: data.deliveryFloor || null,
          phone_number: data.phoneNumber,
        },
        { onConflict: 'id' }
      );
      if (saveErr) {
        throw new Error(saveErr.message);
      }

      const newProfile: UserProfile = {
        ...MOCK_USER_PROFILE,
        id: resolvedUserId,
        email: cleanEmail,
        fullName: data.fullName.trim(),
        phoneNumber: data.phoneNumber,
        role: 'user',
        companyId: data.companyId,
        companyName: data.companyName,
        locationName: data.locationName,
        buildingName: data.buildingName || data.locationName,
        deliveryFloor: data.deliveryFloor || '',
        createdAt: new Date().toISOString(),
      };

      setPendingOAuthUser(null);
      setCurrentUser(newProfile);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newProfile));
      setIsLoading(false);
      return newProfile;
    } catch (err: any) {
      reportError('complete_registration', err);
      setIsLoading(false);
      throw new Error(err.message || 'Could not finalize profile registration.');
    }
  };

  const signInWithSocial = async (provider: 'google' | 'apple'): Promise<boolean> => {
    clearErrors();
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setError('Supabase OAuth is not configured.');
        setIsLoading(false);
        return false;
      }

      const redirectUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : Linking.createURL('auth/callback');

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          queryParams:
            provider === 'google'
              ? {
                  access_type: 'offline',
                  prompt: 'select_account',
                }
              : undefined,
        },
      });

      if (oauthError) {
        setError(oauthError.message || `Could not sign in with ${provider}.`);
        setIsLoading(false);
        return false;
      }

      // On web, browser redirects to Google/Apple OAuth screen and returns to /auth/callback
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}.`);
      setIsLoading(false);
      return false;
    }
  };

  const simulateSignIn = async (role: UserRole = 'user'): Promise<void> => {
    clearErrors();
    setIsLoading(true);
    const matchedCompany = WHITELISTED_COMPANY_DOMAINS[0];
    const profile: UserProfile = {
      ...MOCK_USER_PROFILE,
      id: role === 'admin' ? 'usr_admin_demo' : `usr_demo_${Date.now()}`,
      email: role === 'admin' ? 'admin@yourkitchenco.co.za' : '',
      fullName: role === 'admin' ? 'Chef Marcus (Central Kitchen)' : 'Alex Van Der Berg',
      role,
      companyId: matchedCompany.id,
      companyName: matchedCompany.companyName,
      locationName: matchedCompany.locationName,
      buildingName: matchedCompany.buildingName,
      deliveryFloor: matchedCompany.deliveryFloor || 'Floor 3 (Reception Pantry)',
      createdAt: new Date().toISOString(),
    };

    setCurrentUser(profile);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    setIsLoading(false);
  };

  const verifyDomainAndSendOtp = async (email: string, _phoneNumber?: string): Promise<boolean> => {
    return sendPin(email);
  };

  const signInWithPassword = async (email: string, password: string): Promise<boolean> => {
    clearErrors();
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const domain = extractDomain(cleanEmail);
      const matchedCompany = checkDomainWhitelist(domain) || WHITELISTED_COMPANY_DOMAINS[0];

      if (!password || password.length < 4) {
        setError('Please enter your password.');
        setIsLoading(false);
        return false;
      }

      if (isSupabaseConfigured()) {
        const { data, error: sbError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (sbError) {
          setError(sbError.message || 'Invalid email or password.');
          setIsLoading(false);
          return false;
        }

        if (data?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*, companies(name)')
            .eq('id', data.user.id)
            .single();

          if (!hasCompletedRegistration(profileData)) {
            await supabase.auth.signOut();
            setError(INCOMPLETE_REGISTRATION_MESSAGE);
            setIsLoading(false);
            return false;
          }

          const companyName = profileData?.companies?.name || matchedCompany.companyName;

          const userProfile: UserProfile = {
            id: data.user.id,
            email: cleanEmail,
            fullName: profileData?.full_name || data.user.user_metadata?.full_name || cleanEmail.split('@')[0].replace('.', ' '),
            phoneNumber: profileData?.phone_number || '',
            role: (profileData?.role as UserRole) || 'user',
            companyId: profileData?.company_id || matchedCompany.id,
            companyName: companyName,
            locationName: profileData?.location_name || matchedCompany.locationName,
            buildingName: profileData?.building_name || matchedCompany.buildingName,
            deliveryFloor: profileData?.delivery_floor || matchedCompany.deliveryFloor || 'Floor 3 (Reception Pantry)',
            createdAt: profileData?.created_at || new Date().toISOString(),
          };

          setCurrentUser(userProfile);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
          setIsLoading(false);
          return true;
        }
      }

      setError('Database connection is not configured.');
      setIsLoading(false);
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setIsLoading(false);
      return false;
    }
  };

  const setPasswordAndCompleteProfile = async (
    password: string,
    fullName?: string,
    phoneNumber?: string
  ): Promise<boolean> => {
    clearErrors();
    setIsLoading(true);

    try {
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters.');
        setIsLoading(false);
        return false;
      }

      const email = pendingOtpData?.email || otpSentEmail || MOCK_USER_PROFILE.email;
      const phone = phoneNumber || pendingOtpData?.phone || '';
      const domain = extractDomain(email);
      const matchedCompany = checkDomainWhitelist(domain) || WHITELISTED_COMPANY_DOMAINS[0];

      if (isSupabaseConfigured()) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password,
          data: {
            full_name: fullName,
            phone_number: phone,
          },
        });

        if (pwdError) {
          setError(pwdError.message);
          setIsLoading(false);
          return false;
        }
      }

      const nameParts = email.split('@')[0].split('.');
      const resolvedName =
        fullName ||
        nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

      const profile: UserProfile = {
        id: `usr_${Date.now()}`,
        email,
        fullName: resolvedName,
        phoneNumber: phone,
        role: 'user',
        companyId: matchedCompany.id,
        companyName: matchedCompany.companyName,
        locationName: matchedCompany.locationName,
        buildingName: matchedCompany.buildingName,
        deliveryFloor: matchedCompany.deliveryFloor || 'Floor 3 (Reception Pantry)',
        createdAt: new Date().toISOString(),
      };

      setCurrentUser(profile);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
      setIsPasswordModalVisible(false);
      setOtpSentEmail(null);
      setPendingOtpData(null);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to set password. Please try again.');
      setIsLoading(false);
      return false;
    }
  };

  const updateDropoffFloor = async (newFloor: string) => {
    if (!currentUser) return;
    const updated: UserProfile = {
      ...currentUser,
      deliveryFloor: newFloor,
    };
    setCurrentUser(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured()) {
      await supabase
        .from('profiles')
        .update({ delivery_floor: newFloor })
        .eq('id', currentUser.id);
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated: UserProfile = {
      ...currentUser,
      ...updates,
    };
    setCurrentUser(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured()) {
      const dbUpdates: Record<string, any> = {};
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.phoneNumber !== undefined) dbUpdates.phone_number = updates.phoneNumber;
      if (updates.deliveryFloor !== undefined) dbUpdates.delivery_floor = updates.deliveryFloor;
      if (updates.locationName !== undefined) dbUpdates.location_name = updates.locationName;
      if (updates.buildingName !== undefined) dbUpdates.building_name = updates.buildingName;

      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);
      }
    }
  };

  const setMockRole = async (role: UserRole) => {
    if (!currentUser) return;
    const updated: UserProfile = {
      ...currentUser,
      role,
    };
    setCurrentUser(updated);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
    clearErrors();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return false;
    }

    setRecoveryEmail(cleanEmail);

    if (isSupabaseConfigured()) {
      try {
        const redirectUrl =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? `${window.location.origin}/auth/reset-password?type=recovery`
            : Linking.createURL('reset-password');

        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl,
        });
        if (resetErr) {
          setError(resetErr.message);
          return false;
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to send password reset email.');
        return false;
      }
    }

    return true;
  };

  const verifyRecoveryOtp = async (email: string, token: string): Promise<boolean> => {
    clearErrors();
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim();
      if (cleanToken.length !== OTP_LENGTH) {
        setError('Please enter the 8-digit recovery code from your email.');
        setIsLoading(false);
        return false;
      }

      if (isSupabaseConfigured()) {
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'recovery',
        });

        if (verifyErr) {
          setError(verifyErr.message || 'Invalid or expired recovery code.');
          setIsLoading(false);
          return false;
        }
      }

      setRecoveryEmail(cleanEmail);
      setIsPasswordRecoveryMode(true);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Could not verify recovery code.');
      setIsLoading(false);
      return false;
    }
  };

  const resetUserPassword = async (newPassword: string): Promise<boolean> => {
    clearErrors();
    setIsLoading(true);
    try {
      if (!newPassword || newPassword.length < 8) {
        setError('New password must be at least 8 characters.');
        setIsLoading(false);
        return false;
      }

      if (isSupabaseConfigured()) {
        const { data, error: updateErr } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateErr) {
          setError(updateErr.message || 'Failed to update password. Your reset link may have expired.');
          setIsLoading(false);
          return false;
        }

        // Clear URL hash on web if present
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Hydrate the user's profile and sign them straight in
        if (data?.user) {
          const cleanEmail = data.user.email || recoveryEmail;
          const domain = extractDomain(cleanEmail);
          const matchedCompany = checkDomainWhitelist(domain) || WHITELISTED_COMPANY_DOMAINS[0];

          const { data: profileData } = await supabase
            .from('profiles')
            .select('*, companies(name)')
            .eq('id', data.user.id)
            .single();

          if (!hasCompletedRegistration(profileData)) {
            await supabase.auth.signOut();
            setIsPasswordRecoveryMode(false);
            setError(INCOMPLETE_REGISTRATION_MESSAGE);
            setIsLoading(false);
            return false;
          }

          const companyName = profileData?.companies?.name || matchedCompany.companyName;

          const userProfile: UserProfile = {
            id: data.user.id,
            email: cleanEmail,
            fullName: profileData?.full_name || data.user.user_metadata?.full_name || cleanEmail.split('@')[0].replace('.', ' '),
            phoneNumber: profileData?.phone_number || '',
            role: (profileData?.role as UserRole) || 'user',
            companyId: profileData?.company_id || matchedCompany.id,
            companyName,
            locationName: profileData?.location_name || matchedCompany.locationName,
            buildingName: profileData?.building_name || matchedCompany.buildingName,
            deliveryFloor: profileData?.delivery_floor || matchedCompany.deliveryFloor || 'Floor 3 (Reception Pantry)',
            createdAt: profileData?.created_at || new Date().toISOString(),
          };

          setIsPasswordRecoveryMode(false);
          setCurrentUser(userProfile);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
          setIsLoading(false);
          return true;
        }
      }

      setIsPasswordRecoveryMode(false);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
      setIsLoading(false);
      return false;
    }
  };

  const signOut = async () => {
    try {
      setCurrentUser(null);
      setPendingOAuthUser(null);
      setHasPromptedDeliveryDate(false);
      setIsPasswordRecoveryMode(false);

      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);

      if (isSupabaseConfigured()) {
        Promise.race([
          supabase.auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]).catch((e) => {
          console.warn('Supabase signOut notice:', e);
        });
      }
    } catch (err) {
      console.warn('Error clearing stored session:', err);
      setCurrentUser(null);
      setPendingOAuthUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const openPasswordModalForPendingUser = () => {
    setIsPasswordModalVisible(true);
  };

  const closePasswordModal = () => {
    setIsPasswordModalVisible(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        error,
        domainError,
        otpSentEmail,
        pendingOtpData,
        pendingOAuthUser,
        isPasswordModalVisible,
        isPasswordRecoveryMode,
        recoveryEmail,
        verifyDomainAndSendOtp,
        sendPin,
        verifyPin,
        simulateSignUp,
        completeRegistration,
        signInWithPassword,
        signInWithSocial,
        simulateSignIn,
        setPasswordAndCompleteProfile,
        updateDropoffFloor,
        updateUserProfile,
        setMockRole,
        forgotPassword,
        verifyRecoveryOtp,
        resetUserPassword,
        clearPasswordRecoveryMode,
        clearPendingOAuthUser,
        signOut,
        clearErrors,
        openPasswordModalForPendingUser,
        closePasswordModal,
        hasPromptedDeliveryDate,
        markDeliveryDatePrompted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
