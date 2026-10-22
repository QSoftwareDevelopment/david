import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import type { Dashboard } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { useAuth } from '@/auth/AuthProvider';
import { fullName, dateShort, nights, DEPARTMENT_LABEL, REQUEST_LABEL, timeAgo } from '@/format';
import { colors, font, fonts, space } from '@/theme';
import { ViewSwitcher } from '@/ui/ViewSwitcher';
import { Avatar, Badge, Card, Empty, Loading, Problem, Row, Screen, SectionLabel, Title } from '@/ui/kit';

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'urgent' }) {
  return (
    <View style={{ width: '47.5%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: tone === 'urgent' && value > 0 ? colors.danger : colors.line, padding: space.md, margin: 4 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 30, color: tone === 'urgent' && value > 0 ? colors.danger : colors.text }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: font.sm }}>{label}</Text>
    </View>
  );
}

/** Today: who is arriving, what is open, and what David already knows about the people walking in. */
export default function Today() {
  const router = useRouter();
  const { hotel, now, access, scoped } = useAuth();
  const { data, error, loading, reload } = useFetch<Dashboard>('/api/dashboard', { pollMs: 20_000 });

  // The front desk greets the day's arrivals, so it sees them; other departments don't.
  const desk = scoped && access.department === 'front_desk';
  const greeting = new Date(now).getHours() < 12 ? 'Good morning' : 'Good day';
  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Title sub={data ? dateShort(data.today) : undefined}>{scoped && access.department ? DEPARTMENT_LABEL[access.department] : hotel ? hotel.name : greeting}</Title>
      <ViewSwitcher />
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data ? (
        <>
          {scoped ? (
            <Row style={{ flexWrap: 'wrap', marginHorizontal: -4 }}>
              <Stat value={data.stats.openRequests} label="Waiting for you" tone="urgent" />
              <Stat value={data.board?.urgent ?? 0} label="Urgent" tone="urgent" />
              {desk ? <Stat value={data.stats.arrivalsToday} label="Arriving today" /> : <Stat value={data.stats.requestsToday} label="Done today" />}
              {desk ? <Stat value={data.stats.inHouse} label="In house" /> : <Stat value={data.board?.oldestMinutes ?? 0} label="Longest wait (min)" />}
            </Row>
          ) : (
            <Row style={{ flexWrap: 'wrap', marginHorizontal: -4 }}>
              <Stat value={data.stats.arrivalsToday} label="Arriving today" />
              <Stat value={data.stats.inHouse} label="In house" />
              <Stat value={data.stats.openRequests} label="Open requests" tone="urgent" />
              <Stat value={data.stats.repeatGuestsInHouse} label="Returning guests" />
            </Row>
          )}

          {!scoped && data.departments.length > 0 ? (
            <>
              <SectionLabel>Departments</SectionLabel>
              {data.departments.map((d) => (
                <Card key={d.department} tone={d.urgent > 0 ? 'urgent' : undefined} onPress={() => router.push({ pathname: '/requests', params: { department: d.department } })}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{d.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: font.sm }}>
                        {d.open === 0 ? 'All clear' : `${d.open} open${d.oldestMinutes != null ? ` · longest wait ${d.oldestMinutes < 60 ? `${d.oldestMinutes} min` : `${Math.floor(d.oldestMinutes / 60)}h ${d.oldestMinutes % 60}m`}` : ''}`}
                        {d.doneToday > 0 ? ` · ${d.doneToday} done today` : ''}
                      </Text>
                    </View>
                    {d.urgent > 0 ? <Badge label={`${d.urgent} urgent`} tone="danger" /> : d.open === 0 ? <Badge label="Clear" tone="ok" /> : <Badge label={`${d.open}`} tone="warn" />}
                  </Row>
                </Card>
              ))}
            </>
          ) : null}

          {data.urgent.length > 0 ? (
            <>
              <SectionLabel>{scoped ? 'Your queue' : 'Needs attention'}</SectionLabel>
              {data.urgent.map((r) => (
                <Card key={r.id} tone={r.priority === 'urgent' ? 'urgent' : undefined} onPress={() => (scoped ? router.push('/requests') : router.push(`/guest/${r.guestId}`))}>
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

          {!scoped || desk ? <SectionLabel>Arriving today</SectionLabel> : null}
          {(!scoped || desk) && data.arrivals.length === 0 ? <Empty title="No arrivals today" body="Guests arriving later this week are under Guests." /> : null}
          {data.arrivals.map(({ guest, stay, pastStays, asked, touches }) => {
            const name = fullName(guest);
            return (
              <Card key={stay.id} onPress={scoped ? undefined : () => router.push(`/guest/${guest.id}`)}>
                <Row>
                  <Avatar name={name} vip={guest.vip} />
                  <View style={{ marginLeft: space.md, flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{name}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.sm }}>{nights(stay.arrival, stay.departure)} nights · party of {stay.partySize}</Text>
                  </View>
                  {pastStays > 0 ? <Badge label={`Stay ${pastStays + 1}`} tone="brass" /> : <Badge label="First stay" tone="info" />}
                </Row>
                {asked.length > 0 ? (
                  <View style={{ marginTop: space.md }}>
                    <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.6 }}>ASKED FOR AHEAD OF TIME</Text>
                    {asked.map((r) => (
                      <Row key={r.id} style={{ marginTop: 4, alignItems: 'flex-start' }}>
                        <Badge label={REQUEST_LABEL[r.kind] ?? r.kind} tone="info" />
                        <Text style={{ color: colors.text, fontSize: font.sm, marginLeft: space.sm, flex: 1 }}>{r.summary.replace(/^[A-Za-z][A-Za-z -]*:\s*/, '')}</Text>
                      </Row>
                    ))}
                  </View>
                ) : null}
                {stay.notes ? <Text style={{ marginTop: space.sm, color: colors.text, fontSize: font.sm }}><Text style={{ fontWeight: '700' }}>Booking note: </Text>{stay.notes}</Text> : null}
                {touches.length > 0 ? (
                  <View style={{ marginTop: space.md }}>
                    <Text style={{ color: colors.brassDeep, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.6 }}>MAKE IT MEMORABLE</Text>
                    {touches.map((t) => (
                      <View key={t.text} style={{ marginTop: 4 }}>
                        <Text style={{ color: colors.text, fontSize: font.sm }}>{t.text}</Text>
                        <Text style={{ color: colors.muted, fontSize: font.xs }}>{t.because}</Text>
                      </View>
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
