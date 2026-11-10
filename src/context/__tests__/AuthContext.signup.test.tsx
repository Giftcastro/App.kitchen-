import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../../config/supabase';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `kitchenco://${path}`,
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('../../config/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      verifyOtp: jest.fn(),
      updateUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn(),
  },
}));

const USER = { id: 'user-1', email: 'person@example.com', app_metadata: { provider: 'email' }, user_metadata: {} };
const USER_WITH_UUID = { ...USER, id: '11111111-1111-4111-8111-111111111111' };

// What the sign-up trigger stores before a person has chosen a company.
const NEW_PROFILE = { id: 'user-1', role: 'user', company_id: null, location_name: 'Corporate Campus' };

let auth: ReturnType<typeof useAuth>;
const Capture = () => {
  auth = useAuth();
  return null;
};

const setProfile = (profile: unknown) => {
  (supabase.from as jest.Mock).mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: profile }),
        single: async () => ({ data: profile }),
      }),
    }),
  });
};

const STORAGE_KEY = '@kitchen_co_user_profile';
const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const DETAILS = {
  fullName: 'New Person',
  password: 'pw',
  companyId: COMPANY_ID,
  companyName: 'Test Co',
  locationName: 'Site One',
  phoneNumber: '071 000 0000',
  email: 'person@example.com',
};

// A verified person on the details step, with the given result from saving their profile.
const startDetailsStep = async (saveResult: { error: unknown }) => {
  const upsert = jest.fn().mockResolvedValue(saveResult);
  (supabase.from as jest.Mock).mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    upsert,
    insert: jest.fn().mockResolvedValue({ error: null }),
  });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: USER_WITH_UUID } } });
  (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ data: { user: USER_WITH_UUID }, error: null });
  await mount();
  return upsert;
};

const submitDetails = async (details: typeof DETAILS = DETAILS) => {
  let failure: Error | null = null;
  await act(async () => {
    await auth.completeRegistration(details).catch((e: Error) => {
      failure = e;
    });
  });
  return failure as Error | null;
};

const mount = async () => {
  await act(async () => {
    renderer.create(
      <AuthProvider>
        <Capture />
      </AuthProvider>
    );
  });
};

const enterCode = async (code = '12345678') => {
  let result = false;
  await act(async () => {
    result = await auth.verifyPin('person@example.com', code);
  });
  return result;
};

describe('email code sign-in routing', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await require('@react-native-async-storage/async-storage').clear();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({ data: { user: USER }, error: null });
  });

  it('keeps a new user out of the app until they choose a company', async () => {
    setProfile(NEW_PROFILE);
    await mount();
    expect(await enterCode()).toBe(true);
    expect(auth.currentUser).toBeNull();
  });

  it('keeps a user with no profile row out of the app', async () => {
    setProfile(null);
    await mount();
    expect(await enterCode()).toBe(true);
    expect(auth.currentUser).toBeNull();
  });

  it('does not treat a new user as registered when the app restarts mid sign-up', async () => {
    setProfile(NEW_PROFILE);
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: USER } } });
    await mount();
    expect(auth.currentUser).toBeNull();
  });

  it('signs a returning customer straight in', async () => {
    setProfile({
      id: 'user-1',
      role: 'user',
      company_id: 'company-1',
      full_name: 'Returning Person',
      location_name: 'Site One',
      companies: { name: 'Test Co' },
    });
    await mount();
    expect(await enterCode()).toBe(true);
    expect(auth.currentUser?.email).toBe('person@example.com');
    expect(auth.currentUser?.companyId).toBe('company-1');
  });

  it.each(['admin', 'chef'])('signs a returning %s without a company straight in', async (role) => {
    setProfile({ id: 'user-1', role, company_id: null, location_name: 'Kitchen' });
    await mount();
    expect(await enterCode()).toBe(true);
    expect(auth.currentUser?.role).toBe(role);
  });

  it('lets nobody in with a wrong code', async () => {
    setProfile(NEW_PROFILE);
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({ data: { user: null }, error: { message: 'bad code' } });
    await mount();
    expect(await enterCode()).toBe(false);
    expect(auth.currentUser).toBeNull();
  });

  it('saves the phone the person typed and invents no drop-off', async () => {
    const upsert = await startDetailsStep({ error: null });
    expect(await submitDetails()).toBeNull();
    expect(upsert.mock.calls[0][0]).toMatchObject({ phone_number: '071 000 0000', delivery_floor: null });
    expect(auth.currentUser?.phoneNumber).toBe('071 000 0000');
  });

  it('keeps the person out and reports it when saving their details fails', async () => {
    await startDetailsStep({ error: { message: 'Choose one of your company\'s delivery sites' } });
    const failure = await submitDetails();
    expect(failure?.message).toContain('delivery sites');
    expect(auth.currentUser).toBeNull();
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps the person out when the password cannot be set', async () => {
    const upsert = await startDetailsStep({ error: null });
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: { message: 'Password too weak' } });
    expect((await submitDetails())?.message).toContain('too weak');
    expect(upsert).not.toHaveBeenCalled();
    expect(auth.currentUser).toBeNull();
  });

  it('lets a retry with the same password finish registration', async () => {
    const upsert = await startDetailsStep({ error: null });
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { code: 'same_password', message: 'New password should be different from the old password.' },
    });
    expect(await submitDetails()).toBeNull();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(auth.currentUser?.companyId).toBe(COMPANY_ID);
  });

  it('refuses a company that is not a real database record', async () => {
    const upsert = await startDetailsStep({ error: null });
    expect(await submitDetails({ ...DETAILS, companyId: 'comp_mock' })).not.toBeNull();
    expect(upsert).not.toHaveBeenCalled();
    expect(auth.currentUser).toBeNull();
  });

  it('refuses password login for an account whose details never saved', async () => {
    setProfile(NEW_PROFILE);
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ data: { user: USER }, error: null });
    await mount();
    let result = true;
    await act(async () => {
      result = await auth.signInWithPassword('person@example.com', 'Password1!');
    });
    expect(result).toBe(false);
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(auth.currentUser).toBeNull();
  });

  it('clears a cached profile if the account never finished registering', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'user-1', email: 'person@example.com', fullName: 'Cached', role: 'user' }));
    setProfile(NEW_PROFILE);
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: USER } } });
    await mount();
    expect(auth.currentUser).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('shows no invented phone number for an account without one', async () => {
    setProfile({ id: 'user-1', role: 'user', company_id: 'company-1', phone_number: null, companies: { name: 'Test Co' } });
    await mount();
    await enterCode();
    expect(auth.currentUser?.phoneNumber).toBe('');
  });

  it('rejects a code of the wrong length without calling the server', async () => {
    setProfile(NEW_PROFILE);
    await mount();
    expect(await enterCode('123456')).toBe(false);
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
