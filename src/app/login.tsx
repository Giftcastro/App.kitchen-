/** LoginPage.xaml + LoginViewModel. */
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../components/AppText';
import { alerts } from '../components/Alerts';
import { BoxEntry, Btn, CheckBox, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { SuspendedAccountError } from '../services/auth';

export default function LoginScreen() {
  const { colors, isDark, signIn } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);

  const login = async () => {
    if (!email.trim()) {
      await alerts.show('Login Error', 'Please enter a valid email address.', 'OK');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      // Routing to AdminShell / the delivery-day picker happens in the root
      // layout as soon as the signed-in user lands in state.
      await signIn(email, password);
    } catch (err) {
      if (err instanceof SuspendedAccountError) {
        await alerts.show('Account Suspended', 'This account has been suspended. Please contact your admin.', 'OK');
      } else if (/invalid login credentials/i.test(String((err as Error)?.message))) {
        await alerts.show('Login Error', 'Incorrect email or password. Please try again.', 'OK');
      } else {
        await alerts.show('Login Error', (err as Error)?.message || 'Could not sign in — check your connection and try again.', 'OK');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoGrid}>
          <View style={[styles.glowOuter, { backgroundColor: colors.brandPopGlowOuter }]} pointerEvents="none" />
          <View style={[styles.glowInner, { backgroundColor: colors.brandPopGlowInner }]} pointerEvents="none" />
          <Image
            source={isDark ? require('../../assets/images/yourkcodark.png') : require('../../assets/images/yourkcolight.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Your Kitchen Co."
          />
        </View>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to continue</Text>

        <View style={styles.form}>
          <BoxEntry testID="login-email" value={email} onChangeText={setEmail} placeholder="Email Address (e.g., alex@example.com)" keyboardType="email-address" />
          <BoxEntry testID="login-password" value={password} onChangeText={setPassword} placeholder="Password (e.g., ••••••••)" secure />
          <View style={styles.row}>
            <View style={styles.remember}>
              <CheckBox checked={rememberMe} onToggle={() => setRememberMe(v => !v)} />
              <Text style={[styles.small, { color: colors.textSecondary }]}>Remember me</Text>
            </View>
            <Pressable onPress={() => alerts.show('Help', 'Forgot password logic coming soon!', 'OK')} hitSlop={8}>
              <Text style={[styles.small, styles.bold, { color: colors.primary }]}>Forgot Password?</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.actions}>
          <Btn
            testID="login-submit"
            title={busy ? 'Signing in…' : '🔐  SECURE LOGIN'}
            onPress={login}
            bold
            fontSize={15}
            height={50}
            radius={25}
            style={styles.loginShadow}
          />
          <View style={styles.signupRow}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Don&apos;t have an account?</Text>
            <Pressable onPress={() => router.push('/register')} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.bold, { color: colors.primary, fontSize: 14 }]}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 30, gap: 20 },
  logoGrid: { height: 350, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  glowOuter: { position: 'absolute', width: 130, height: 130, borderRadius: 65 },
  glowInner: { position: 'absolute', width: 78, height: 78, borderRadius: 39 },
  logo: { width: '100%', height: 350 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: -10, marginBottom: 15 },
  form: { gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 2, marginVertical: 4 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontSize: 13 },
  bold: { fontWeight: '700' },
  actions: { gap: 16, marginTop: 10 },
  loginShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 6, elevation: 3 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
});
