import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import type { GuestRow } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { dateShort, fullName, prettyPhone } from '@/format';
import { colors, font, radius, space } from '@/theme';
import { Avatar, Badge, Button, Card, Empty, Loading, Problem, Row, Screen, Title } from '@/ui/kit';

export default function Guests() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data, error, loading, reload } = useFetch<{ guests: GuestRow[] }>(`/api/guests${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`);

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Title sub={data ? `${data.guests.length} guests` : undefined} right={<Button small label="Add" onPress={() => router.push('/guest-new')} />}>Guests</Title>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search name or number"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: space.md, paddingVertical: 11, fontSize: font.md, marginBottom: space.md }}
      />
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.guests.length === 0 ? <Empty title={debounced ? 'No one matches' : 'No guests yet'} body={debounced ? undefined : 'Add a guest and their stay, and David starts looking after them.'} /> : null}
      {data?.guests.map((g) => {
        const name = fullName(g);
        return (
          <Card key={g.id} onPress={() => router.push(`/guest/${g.id}`)}>
            <Row>
              <Avatar name={name} vip={g.vip} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{name}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>
                  {prettyPhone(g.phone)}{g.lastArrival ? ` · ${dateShort(g.lastArrival)}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {g.consent === 'opted_out' ? <Badge label="Opted out" tone="danger" /> : g.consent === 'unknown' ? <Badge label="No consent yet" tone="warn" /> : null}
                {g.openRequests > 0 ? <View style={{ marginTop: 4 }}><Badge label={`${g.openRequests} open`} tone="info" /></View> : null}
              </View>
            </Row>
            {g.interests && g.interests.length > 0 ? (
              <Text style={{ color: colors.text, fontSize: font.sm, marginTop: space.sm }}>{g.interests.join(' · ')}</Text>
            ) : (
              <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: space.sm }}>Still getting to know them</Text>
            )}
            <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: 4 }}>
              {g.stayCount} stay{g.stayCount === 1 ? '' : 's'} · {g.memoryCount} thing{g.memoryCount === 1 ? '' : 's'} known
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
}
