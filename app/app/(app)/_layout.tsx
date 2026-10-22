import { Stack } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { colors, fonts } from '@/theme';

export default function AppLayout() {
  const { viewAs } = useAuth();
  return (
    // Switching who the demo is pretending to be starts the app fresh as that person.
    <Stack key={viewAs} screenOptions={{ headerTintColor: colors.ink, headerTitleStyle: { fontFamily: fonts.displayMedium, color: colors.text }, headerStyle: { backgroundColor: colors.paper }, headerShadowVisible: false, headerBackTitle: 'Back', contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="guest/[id]" options={{ title: '' }} />
      <Stack.Screen name="guest-new" options={{ title: 'New guest', presentation: 'modal' }} />
      <Stack.Screen name="campaigns" options={{ title: 'Campaigns' }} />
      <Stack.Screen name="campaign/[id]" options={{ title: 'Campaign' }} />
      <Stack.Screen name="services" options={{ title: 'Menu & services' }} />
      <Stack.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Stack.Screen name="team" options={{ title: 'Team' }} />
      <Stack.Screen name="square" options={{ title: 'Square' }} />
      <Stack.Screen name="settings" options={{ title: 'Hotel settings' }} />
      <Stack.Screen name="simulator" options={{ title: 'Guest phone', presentation: 'modal' }} />
    </Stack>
  );
}
