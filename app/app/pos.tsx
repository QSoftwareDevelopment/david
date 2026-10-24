import React from 'react';
import { Text, View } from 'react-native';

import { useFetch } from '@/api/useFetch';
import { colors, font, fonts, space } from '@/theme';
import { Badge, Card, Row, Screen } from '@/ui/kit';

type Table = { id: string; label: string; seats: number; x: number; y: number };
type Booking = { requestId: string; table: string; time: string; party: number; guestName: string; room: string | null; dietary: string[]; onFile: string[]; occasion: string | null; frontDeskNote: string | null; previous: { date: string; summary: string; table: string | null }[] };

/**
 * A stand-in for the restaurant's own booking or POS system, for the demo. A real one is the restaurant's software:
 * this shows what it would receive from David (the party, the allergy, the occasion, the last visit) and the floor map
 * with the table it books. Demo only.
 */
export default function Pos() {
  const { data } = useFetch<{ tables: Table[]; bookings: Booking[] }>('/api/demo/pos', { pollMs: 1500 });
  const tables = data?.tables ?? [];
  const bookings = data?.bookings ?? [];
  const byTable = new Map(bookings.map((b) => [b.table, b]));
  return (
    <Screen>
      <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1 }}>RESTAURANT SYSTEM · DEMO STAND-IN</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: -0.8, marginBottom: space.md }}>Tonight's floor</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: space.lg }}>
        {tables.map((t) => {
          const b = byTable.get(t.id);
          return (
            <View key={t.id} style={{ width: '23%', minWidth: 130, flexGrow: 1, borderRadius: 16, borderWidth: 1, borderColor: b ? colors.ink : colors.line, backgroundColor: b ? colors.ink : colors.card, padding: 12 }}>
              <Text style={{ color: b ? 'rgba(255,255,255,0.75)' : colors.muted, fontSize: font.xs, fontWeight: '700' }}>{t.id} · {t.label} · {t.seats} seats</Text>
              {b ? (
                <>
                  <Text style={{ color: '#fff', fontFamily: fonts.displayMedium, fontSize: 17, marginTop: 4 }}>{b.guestName}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: font.sm }}>{b.time} · party of {b.party}</Text>
                  {b.occasion ? <Text style={{ color: colors.brass, fontSize: font.xs, fontWeight: '700', marginTop: 2 }}>★ {b.occasion}</Text> : null}
                </>
              ) : <Text style={{ color: colors.textTertiary, marginTop: 6 }}>Free</Text>}
            </View>
          );
        })}
      </View>

      <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginBottom: space.sm }}>BOOKINGS FROM THE HOTEL</Text>
      {bookings.length === 0 ? <Text style={{ color: colors.muted }}>Nothing yet. When the front desk sends a restaurant request, the booking and everything David knows about the guest appears here.</Text> : null}
      {bookings.map((b) => (
        <Card key={b.requestId}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{b.guestName}{b.room ? ` · Room ${b.room}` : ''}</Text>
            <Badge label={`${b.table} · ${b.time}`} tone="ok" />
          </Row>
          <Text style={{ color: colors.muted, fontSize: font.sm }}>Party of {b.party}</Text>
          {b.dietary.map((d) => <View key={d} style={{ marginTop: 6, alignSelf: 'flex-start' }}><Badge label={d} tone="danger" /></View>)}
          {b.frontDeskNote ? <Text style={{ marginTop: 6, color: colors.text }}><Text style={{ fontWeight: '700' }}>Front desk: </Text>{b.frontDeskNote}</Text> : null}
          {b.onFile.map((f) => <Text key={f} style={{ color: colors.text, fontSize: font.sm, marginTop: 2 }}>• {f}</Text>)}
          {b.previous.length ? <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 6 }}>Last visits: {b.previous.map((p) => `${p.date}${p.table ? ` (${p.table})` : ''}`).join(', ')}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}
