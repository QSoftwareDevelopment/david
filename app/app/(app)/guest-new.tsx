import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { post } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { addDays, isDate, localDate } from '@/dates';
import { colors, font, space } from '@/theme';
import { Button, Card, Chip, Field, Row, Screen } from '@/ui/kit';

export default function NewGuest() {
  const router = useRouter();
  const { hotel, now } = useAuth();
  const today = localDate(new Date(now), hotel?.timezone ?? 'UTC');
  const [phone, setPhone] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [consent, setConsent] = useState(false);
  const [vip, setVip] = useState(false);
  const [withStay, setWithStay] = useState(true);
  const [arrival, setArrival] = useState(addDays(today, 1));
  const [stayNights, setNights] = useState(2);
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departure = isDate(arrival) ? addDays(arrival, stayNights) : '';

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const r = await post<{ guest: { id: string } }>('/api/guests', {
        phone, firstName: first.trim() || undefined, lastName: last.trim() || undefined, vip, consent,
        stay: withStay && isDate(arrival) ? { arrival, departure, room: room.trim() || undefined } : undefined,
      });
      router.replace(`/guest/${r.guest.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the guest.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(416) 555-0123" />
      <Row>
        <View style={{ flex: 1, marginRight: space.sm }}><Field label="First name" value={first} onChangeText={setFirst} /></View>
        <View style={{ flex: 1 }}><Field label="Last name" value={last} onChangeText={setLast} /></View>
      </Row>

      <Card>
        <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
          <Row>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: consent ? colors.ink : 'transparent', marginRight: space.md, alignItems: 'center', justifyContent: 'center' }}>
              {consent ? <Text style={{ color: colors.inverse, fontWeight: '800' }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>Guest agreed to receive texts</Text>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>Tick only if they said yes when booking. David texts first only to guests who have.</Text>
            </View>
          </Row>
        </Pressable>
        <Pressable onPress={() => setVip(!vip)} accessibilityRole="checkbox" accessibilityState={{ checked: vip }} style={{ marginTop: space.md }}>
          <Row>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: vip ? colors.ink : 'transparent', marginRight: space.md, alignItems: 'center', justifyContent: 'center' }}>
              {vip ? <Text style={{ color: colors.inverse, fontWeight: '800' }}>✓</Text> : null}
            </View>
            <Text style={{ fontWeight: '700', color: colors.text }}>VIP</Text>
          </Row>
        </Pressable>
      </Card>

      <Row style={{ flexWrap: 'wrap', marginTop: space.sm }}>
        <Chip label="With a stay" on={withStay} onPress={() => setWithStay(true)} />
        <Chip label="Just the guest" on={!withStay} onPress={() => setWithStay(false)} />
      </Row>
      {withStay ? (
        <>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="Today" on={arrival === today} onPress={() => setArrival(today)} />
            <Chip label="Tomorrow" on={arrival === addDays(today, 1)} onPress={() => setArrival(addDays(today, 1))} />
            <Chip label="In 3 days" on={arrival === addDays(today, 3)} onPress={() => setArrival(addDays(today, 3))} />
          </Row>
          <Field label="Arrival" value={arrival} onChangeText={setArrival} autoCapitalize="none" placeholder="2026-04-02" />
          <Text style={{ fontSize: font.sm, fontWeight: '600', marginBottom: 6 }}>Nights</Text>
          <Row style={{ flexWrap: 'wrap' }}>{[1, 2, 3, 4, 5, 7].map((n) => <Chip key={n} label={String(n)} on={n === stayNights} onPress={() => setNights(n)} />)}</Row>
          <Text style={{ color: colors.muted, marginBottom: space.md }}>Departs {departure || '—'}</Text>
          <Field label="Room (optional)" value={room} onChangeText={setRoom} />
        </>
      ) : null}
      {error ? <Text style={{ color: colors.danger, marginBottom: space.sm }} accessibilityRole="alert">{error}</Text> : null}
      <Button label="Add guest" loading={busy} disabled={!phone.trim()} onPress={save} />
    </Screen>
  );
}
