import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import type { Dashboard } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { useAuth } from '@/auth/AuthProvider';
import { fullName, dateShort, nights, REQUEST_LABEL, timeAgo } from '@/format';
import { colors, font, space } from '@/theme';
import { Avatar, Badge, Card, Empty, Loading, Problem, Row, Screen, SectionLabel, Title } from '@/ui/kit';

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'urgent' }) {
  return (
    <View style={{ width: '47.5%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: tone === 'urgent' && value > 0 ? colors.danger : colors.line, padding: space.md, margin: 4 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: tone === 'urgent' && value > 0 ? colors.danger : colors.ink }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: font.sm }}>{label}</Text>
    </View>
  );
}

/** Today: who is arriving, what is open, and what David already knows about the people walking in. */
export default function Today() {
  const router = useRouter();
  const { hotel, now } = useAuth();
  const { data, error, loading, reload } = useFetch<Dashboard>('/api/dashboard', { pollMs: 20_000 });

  const greeting = new Date(now).getHours() < 12 ? 'Good morning' : 'Good day';
  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Title sub={data ? dateShort(data.today) : undefined}>{hotel ? hotel.name : greeting}</Title>
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data ? (
        <>
          <Row style={{ flexWrap: 'wrap', marginHorizontal: -4 }}>
            <Stat value={data.stats.arrivalsToday} label="Arriving today" />
            <Stat value={data.stats.inHouse} label="In house" />
            <Stat value={data.stats.openRequests} label="Open requests" tone="urgent" />
            <Stat value={data.stats.repeatGuestsInHouse} label="Returning guests" />
          </Row>

          {data.urgent.length > 0 ? (
            <>
              <SectionLabel>Needs attention</SectionLabel>
              {data.urgent.map((r) => (
                <Card key={r.id} tone={r.priority === 'urgent' ? 'urgent' : undefined} onPress={() => router.push(`/guest/${r.guestId}`)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{r.guestName}{r.room ? ` · ${r.room}` : ''}</Text>
                    <Badge label={r.priority === 'urgent' ? 'Urgent' : REQUEST_LABEL[r.kind] ?? r.kind} tone={r.priority === 'urgent' ? 'danger' : 'info'} />
                  </Row>
                  <Text style={{ marginTop: 4, color: colors.text }}>{r.summary}</Text>
                  <Text style={{ marginTop: 4, color: colors.muted, fontSize: font.sm }}>{timeAgo(r.createdAt)}</Text>
                </Card>
              ))}
            </>
          ) : null}

          <SectionLabel>Arriving today</SectionLabel>
          {data.arrivals.length === 0 ? <Empty title="No arrivals today" body="Guests arriving later this week are under Guests." /> : null}
          {data.arrivals.map(({ guest, stay, pastStays, memories }) => {
            const name = fullName(guest);
            return (
              <Card key={stay.id} onPress={() => router.push(`/guest/${guest.id}`)}>
                <Row>
                  <Avatar name={name} vip={guest.vip} />
                  <View style={{ marginLeft: space.md, flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{name}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.sm }}>{nights(stay.arrival, stay.departure)} nights · party of {stay.partySize}</Text>
                  </View>
                  {pastStays > 0 ? <Badge label={`Stay ${pastStays + 1}`} tone="brass" /> : <Badge label="First stay" tone="info" />}
                </Row>
                {memories.length > 0 ? (
                  <View style={{ marginTop: space.sm }}>
                    {memories.map((m) => (
                      <Text key={m.id} style={{ color: colors.text, fontSize: font.sm, marginTop: 2 }}>
                        <Text style={{ color: colors.brassDeep, fontWeight: '700' }}>Remember: </Text>
                        {m.key === 'allergy' ? `${m.value} allergy` : m.value}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
