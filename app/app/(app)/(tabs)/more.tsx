import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { colors, font, space } from '@/theme';
import { Button, Card, Row, Screen, SectionLabel, Title } from '@/ui/kit';

function Item({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <Card onPress={onPress}>
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{title}</Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{body}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
      </Row>
    </Card>
  );
}

export default function More() {
  const router = useRouter();
  const { hotel, hotels, chooseHotel, demo, email, signOut } = useAuth();
  return (
    <Screen>
      <Title sub={hotel?.name}>More</Title>
      <Item title="Campaigns" body="The texts David sends first: before arrival, during, after and win-backs." onPress={() => router.push('/campaigns')} />
      <Item title="Menu & services" body="What David can offer: room service, housekeeping, laundry and more." onPress={() => router.push('/services')} />
      <Item title="Square" body={hotel?.square?.connected ? 'Connected. Room service orders go to your Square.' : 'Pull the room service menu from Square and send orders to your kitchen.'} onPress={() => router.push('/square')} />
      <Item title="Hotel settings" body="David's voice, quiet hours, check-in times and the hotel's number." onPress={() => router.push('/settings')} />
      {demo ? <Item title="Guest phone (demo)" body="Text David as a guest and watch the app react." onPress={() => router.push('/simulator')} /> : null}

      {hotels.length > 1 ? (
        <>
          <SectionLabel>Your hotels</SectionLabel>
          {hotels.map((h) => (
            <Button key={h.id} label={h.name + (h.id === hotel?.id ? '  ✓' : '')} variant="secondary" onPress={() => chooseHotel(h.id)} />
          ))}
        </>
      ) : null}

      {!demo ? (
        <>
          <SectionLabel>Account</SectionLabel>
          <Text style={{ color: colors.muted, marginBottom: space.sm }}>{email}</Text>
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </>
      ) : null}
    </Screen>
  );
}
