import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { colors, font, fonts, space } from '@/theme';
import { Button, Card, Field, Screen } from '@/ui/kit';

const ZONES = ['America/Toronto', 'America/New_York', 'America/Vancouver', 'Europe/London', 'Asia/Kolkata', 'Australia/Sydney'];

/** Sign in, create an account, or (once signed in with no hotel yet) set the hotel up. */
export default function AuthScreen() {
  const { status, signIn, signUp, createHotel, demo, signOut } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [zone, setZone] = useState(ZONES[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run(job: () => Promise<void>) {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen dark>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 640 }}>
        <Text style={{ color: colors.brass, fontSize: font.xs, letterSpacing: 3, fontWeight: '700' }}>DAVID</Text>
        <Text style={{ color: colors.inverse, fontFamily: fonts.accent, fontSize: 44, lineHeight: 46, letterSpacing: -1.4, marginTop: space.sm }}>
          The concierge{'\n'}who remembers.
        </Text>
        <Text style={{ color: colors.inverseMuted, marginTop: space.md, marginBottom: space.xl, fontSize: font.md }}>
          David texts your guests, handles room service, housekeeping and laundry, and remembers every habit, so every return feels curated.
        </Text>

        <Card>
          {status === 'needsHotel' ? (
            <>
              <Text style={{ fontSize: font.lg, fontWeight: '700', marginBottom: space.md }}>Set up your hotel</Text>
              <Field label="Hotel name" value={name} onChangeText={setName} placeholder="The Harbour House" />
              <Text style={{ fontSize: font.sm, fontWeight: '600', marginBottom: 6 }}>Time zone</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
                {ZONES.map((z) => (
                  <Button key={z} label={z.split('/')[1]!.replace('_', ' ')} small variant={z === zone ? 'primary' : 'secondary'} onPress={() => setZone(z)} />
                ))}
              </View>
              {error ? <Text style={{ color: colors.danger, marginBottom: space.sm }}>{error}</Text> : null}
              <Button label="Create hotel" loading={busy} disabled={!name.trim()} onPress={() => run(() => createHotel(name.trim(), zone))} />
              <View style={{ height: space.sm }} />
              <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
            </>
          ) : demo ? (
            <Text>Demo mode is on.</Text>
          ) : (
            <>
              <Text style={{ fontSize: font.lg, fontWeight: '700', marginBottom: space.md }}>{mode === 'in' ? 'Sign in' : 'Create your account'}</Text>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
              {error ? <Text style={{ color: colors.danger, marginBottom: space.sm }} accessibilityRole="alert">{error}</Text> : null}
              {note ? <Text style={{ color: colors.ok, marginBottom: space.sm }}>{note}</Text> : null}
              <Button
                label={mode === 'in' ? 'Sign in' : 'Create account'}
                loading={busy}
                disabled={!email.trim() || password.length < 8}
                onPress={() =>
                  run(async () => {
                    if (mode === 'in') await signIn(email, password);
                    else {
                      const r = await signUp(email, password);
                      if (r.needsConfirmation) setNote('Check your email and open the link, then sign in.');
                    }
                  })
                }
              />
              <View style={{ height: space.sm }} />
              <Button label={mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'} variant="ghost" onPress={() => setMode(mode === 'in' ? 'up' : 'in')} />
            </>
          )}
        </Card>
      </View>
    </Screen>
  );
}
