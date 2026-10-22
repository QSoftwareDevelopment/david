import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { post } from '@/api/client';
import type { Guest, GuestRow, Message } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { fullName, prettyPhone, timeAgo } from '@/format';
import { colors, font, radius, space } from '@/theme';
import { Button, Card, Chip, Loading, Row, Screen } from '@/ui/kit';

const IDEAS = [
  'Could I get some extra towels please?',
  'Can I order some room service?',
  "I'm allergic to nuts. Could I get a club sandwich?",
  'Any chance of a late check-out?',
  'The AC is not working',
  'We are here for our anniversary',
  'Can I get laundry done today?',
  'STOP',
];

/** Demo only: be the guest. Text David as one of the hotel's guests and watch the staff app react. */
export default function Simulator() {
  const guests = useFetch<{ guests: GuestRow[] }>('/api/guests');
  const [phone, setPhone] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [clockNote, setClockNote] = useState<string | null>(null);
  const picked = guests.data?.guests.find((g) => g.phone === phone) ?? null;
  const profile = useFetch<{ guest: Guest; thread: Message[] }>(picked ? `/api/guests/${picked.id}` : null, { pollMs: 2_000 });

  async function send(body: string) {
    if (!phone || !body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await post('/api/demo/inbound', { phone, body: body.trim() });
      setText('');
      await profile.reload();
      await guests.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  }

  async function nextDay() {
    setClockNote(null);
    try {
      await post('/api/demo/clock', { advanceHours: 24 });
      const r = await post<{ sent: number }>('/api/demo/tick');
      setClockNote(`A day later. David sent ${r.sent} scheduled text${r.sent === 1 ? '' : 's'}.`);
      await profile.reload();
    } catch (e) {
      setClockNote(e instanceof Error ? e.message : 'Could not move the clock.');
    }
  }

  return (
    <Screen>
      <Text style={{ color: colors.muted, marginBottom: space.md }}>Pick a guest, then text the hotel as them. David answers the same way he would on a real phone.</Text>
      {!guests.data ? <Loading /> : null}
      <Row style={{ flexWrap: 'wrap' }}>
        {guests.data?.guests.map((g) => <Chip key={g.id} label={fullName(g)} on={g.phone === phone} onPress={() => setPhone(g.phone)} />)}
      </Row>

      {phone ? (
        <>
          <Card style={{ backgroundColor: '#EDEBE4' }}>
            <Text style={{ textAlign: 'center', color: colors.muted, fontSize: font.xs, marginBottom: space.sm }}>{picked ? fullName(picked) : ''} · {prettyPhone(phone)}</Text>
            {(profile.data?.thread ?? []).length === 0 ? <Text style={{ color: colors.muted, textAlign: 'center' }}>No messages yet. Say hello.</Text> : null}
            {(profile.data?.thread ?? []).map((m) => {
              const me = m.direction === 'in';
              return (
                <View key={m.id} style={{ alignItems: me ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                  <View style={{ maxWidth: '82%', backgroundColor: me ? '#2F6FE4' : colors.card, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 }}>
                    <Text style={{ color: me ? colors.inverse : colors.text, fontSize: font.md }}>{m.body}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>{timeAgo(m.createdAt)}</Text>
                </View>
              );
            })}
          </Card>
          <Row style={{ flexWrap: 'wrap', marginBottom: space.sm }}>
            {IDEAS.map((i) => <Chip key={i} label={i} onPress={() => void send(i)} />)}
          </Row>
          <Row>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Text the hotel"
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => void send(text)}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill, backgroundColor: colors.card, paddingHorizontal: space.md, paddingVertical: 10, fontSize: font.md }}
            />
            <View style={{ width: space.sm }} />
            <Pressable onPress={() => void send(text)} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Send" style={{ backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 11, opacity: busy || !text.trim() ? 0.5 : 1 }}>
              <Text style={{ color: colors.inverse, fontWeight: '700' }}>Send</Text>
            </Pressable>
          </Row>
          {err ? <Text style={{ color: colors.danger, marginTop: space.sm }}>{err}</Text> : null}
        </>
      ) : null}

      <View style={{ marginTop: space.xl }}>
        <Button label="Skip ahead one day and run campaigns" variant="secondary" onPress={nextDay} />
        {clockNote ? <Text style={{ color: colors.muted, marginTop: space.sm }}>{clockNote}</Text> : null}
      </View>
    </Screen>
  );
}
