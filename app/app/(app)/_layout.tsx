import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.paper }, headerShadowVisible: false, headerBackTitle: 'Back', contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="guest/[id]" options={{ title: '' }} />
      <Stack.Screen name="guest-new" options={{ title: 'New guest', presentation: 'modal' }} />
      <Stack.Screen name="campaigns" options={{ title: 'Campaigns' }} />
      <Stack.Screen name="campaign/[id]" options={{ title: 'Campaign' }} />
      <Stack.Screen name="services" options={{ title: 'Menu & services' }} />
      <Stack.Screen name="settings" options={{ title: 'Hotel settings' }} />
      <Stack.Screen name="simulator" options={{ title: 'Guest phone', presentation: 'modal' }} />
    </Stack>
  );
}
