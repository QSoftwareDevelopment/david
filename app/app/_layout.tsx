import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, useFonts } from '@expo-google-fonts/bricolage-grotesque';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme';

/** The auth wall. One place decides whether somebody may be inside the app. */
function Gate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'restoring') return;
    const inAuth = segments[0] === '(auth)';
    if (status === 'signedIn' && inAuth) router.replace('/(app)/(tabs)');
    else if (status !== 'signedIn' && !inAuth) router.replace('/(auth)/sign-in');
  }, [status, segments, router]);

  if (status === 'restoring') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
        <ActivityIndicator color={colors.inverse} size="large" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  // Headlines use Bricolage Grotesque, like Vic Connect. If it fails to load, the system font stands in.
  const [loaded, failed] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold });
  if (!loaded && !failed) return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
