import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { del, patch, post } from '@/api/client';
import type { Service } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { money } from '@/format';
import { colors, font, space } from '@/theme';
import { Button, Card, Chip, Empty, Field, Loading, Problem, Row, Screen, SectionLabel } from '@/ui/kit';

const CATEGORIES = [
  ['room_service', 'Room service'], ['housekeeping', 'Housekeeping'], ['laundry', 'Laundry'], ['amenity', 'Amenities'], ['transport', 'Transport'], ['other', 'Other'],
] as const;

/** What David is allowed to offer. He only suggests things on this list. */
export default function Services() {
  const { data, error, loading, reload } = useFetch<{ services: Service[] }>('/api/services');
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>('room_service');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    const cents = price.trim() === '' ? null : Math.round(Number(price) * 100);
    if (cents !== null && (!Number.isFinite(cents) || cents < 0)) return setErr('Price should be a number, like 12.50.');
    try {
      await post('/api/services', { category, name: name.trim(), description: desc.trim(), priceCents: cents });
      setName(''); setPrice(''); setDesc(''); setAdding(false);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add that.');
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Button label={adding ? 'Cancel' : 'Add an item'} variant={adding ? 'ghost' : 'secondary'} onPress={() => setAdding(!adding)} />
      {adding ? (
        <Card>
          <Row style={{ flexWrap: 'wrap' }}>{CATEGORIES.map(([k, l]) => <Chip key={k} label={l} on={k === category} onPress={() => setCategory(k)} />)}</Row>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Club sandwich" />
          <Field label="Price (optional)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="24.00" />
          <Field label="Note (optional)" value={desc} onChangeText={setDesc} />
          {err ? <Text style={{ color: colors.danger, marginBottom: space.sm }}>{err}</Text> : null}
          <Button label="Add" disabled={!name.trim()} onPress={add} />
        </Card>
      ) : null}
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.services.length === 0 ? <Empty title="Nothing on the menu" body="Add what guests can ask for. David will only offer what's here." /> : null}
      {CATEGORIES.map(([k, label]) => {
        const items = data?.services.filter((s) => s.category === k) ?? [];
        if (items.length === 0) return null;
        return (
          <View key={k}>
            <SectionLabel>{label}</SectionLabel>
            {items.map((s) => (
              <Card key={s.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{s.name}{s.priceCents != null ? `  ${money(s.priceCents)}` : ''}</Text>
                    {s.squareVariationId ? <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: 2 }}>From Square. Name and price update when you sync.</Text> : null}
                    {s.description ? <Text style={{ color: colors.muted, marginTop: 2 }}>{s.description}</Text> : null}
                    {s.availableFrom ? <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: 2 }}>{s.availableFrom}–{s.availableUntil ?? 'late'}</Text> : null}
                  </View>
                  <Switch value={s.active} onValueChange={async (v) => { await patch(`/api/services/${s.id}`, { active: v }); await reload(); }} trackColor={{ true: colors.ink, false: colors.lineStrong }} accessibilityLabel={`${s.name} available`} />
                </Row>
                <Text onPress={async () => { await del(`/api/services/${s.id}`); await reload(); }} style={{ color: colors.danger, marginTop: space.sm, fontSize: font.sm, fontWeight: '600' }}>Remove</Text>
              </Card>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}
