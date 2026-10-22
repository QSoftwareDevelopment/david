import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
/** Outline at rest, filled when selected, the way Vic Connect's tabs read. */
const icon = (rest: IconName, filled: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? filled : rest} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  // A department sees its queue and nothing about guests.
  const { scoped } = useAuth();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.textTertiary, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line }, tabBarLabelStyle: { fontWeight: '600', fontSize: 11 } }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny-outline', 'sunny') }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: icon('checkmark-done-outline', 'checkmark-done') }} />
      <Tabs.Screen name="guests" options={{ title: 'Guests', tabBarIcon: icon('people-outline', 'people'), href: scoped ? null : undefined }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chatbubbles-outline', 'chatbubbles'), href: scoped ? null : undefined }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
