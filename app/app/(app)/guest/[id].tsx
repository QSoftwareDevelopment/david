import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { patch, post } from '@/api/client';
import type { Guest, GuestRequest, Memory, Message, Stay } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { addDays, isDate, localDate } from '@/dates';
import { useAuth } from '@/auth/AuthProvider';
import { dateShort, fullName, MEMORY_LABEL, nights, prettyPhone, REQUEST_LABEL, timeAgo } from '@/format';
import { colors, font, radius, space } from '@/theme';
import { Avatar, Badge, Button, Card, Chip, Empty, Field, Loading, Problem, Row, Screen, SectionLabel } from '@/ui/kit';

type Profile = { guest: Guest; stays: Stay[]; memories: Memory[]; requests: GuestRequest[]; thread: Message[] };

const SOURCE: Record<Memory['source'], string> = { guest: 'They told us', observed: 'David noticed', staff: 'Added by staff' };
const KINDS = ['preference', 'dietary', 'dislike', 'occasion', 'habit'] as const;

function MemoryRow({ m, onHide }: { m: Memory; onHide: () => void }) {
  const weak = m.confidence < 0.6 && m.kind !== 'dietary';
  return (
    <View style={{ paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line, opacity: m.hidden ? 0.45 : 1 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Row style={{ flexWrap: 'wrap' }}>
            <Badge label={MEMORY_LABEL[m.kind] ?? m.kind} tone={m.kind === 'dietary' ? 'danger' : m.kind === 'habit' ? 'brass' : 'neutral'} />
            <Text style={{ marginLeft: 8, color: colors.muted, fontSize: font.xs }}>{m.key}</Text>
          </Row>
          <Text style={{ marginTop: 4, color: colors.text, fontSize: font.md, textDecorationLine: m.hidden ? 'line-through' : 'none' }}>{m.key === 'allergy' ? `${m.value} allergy` : m.value}</Text>
          <Text style={{ marginTop: 2, color: colors.muted, fontSize: font.xs }}>
            {SOURCE[m.source]}{m.evidence > 1 ? ` · seen ${m.evidence} times` : ''}{weak ? ' · not certain yet' : ''}
          </Text>
        </View>
        <Pressable onPress={onHide} accessibilityRole="button" accessibilityLabel={m.hidden ? 'Show this memory again' : 'Hide this memory'} hitSlop={10}>
          <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: '600' }}>{m.hidden ? 'Restore' : 'Hide'}</Text>
        </Pressable>
      </Row>
    </View>
  );
}

export default function GuestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hotel, now } = useAuth();
  const { data, error, loading, reload } = useFetch<Profile>(id ? `/api/guests/${id}` : null, { pollMs: 5_000 });
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('preference');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [stayOpen, setStayOpen] = useState(false);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [room, setRoom] = useState('');
  const [stayError, setStayError] = useState<string | null>(null);

  if (error && !data) return <Screen><Problem message={error} onRetry={reload} /></Screen>;
  if (!data) return <Screen><Loading /></Screen>;
  const { guest, stays, memories, requests, thread } = data;
  const name = fullName(guest);
  const visible = memories.filter((m) => !m.hidden);
  const hidden = memories.filter((m) => m.hidden);
  const today = localDate(new Date(now), hotel?.timezone ?? 'UTC');

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await post(`/api/guests/${guest.id}/messages`, { body: reply.trim() });
      setReply('');
      await reload();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  }

  async function addMemory() {
    setAddError(null);
    try {
      await post(`/api/guests/${guest.id}/memories`, { kind, key: key.trim() || kind, value: value.trim() });
      setKey('');
      setValue('');
      setAdding(false);
      await reload();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Could not save that.');
    }
  }

  async function addStay() {
    setStayError(null);
    if (!isDate(arrival) || !isDate(departure)) return setStayError('Use dates like 2026-04-02.');
    try {
      await post(`/api/guests/${guest.id}/stays`, { arrival, departure, room: room.trim() || undefined });
      setStayOpen(false);
      setArrival('');
      setDeparture('');
      setRoom('');
      await reload();
    } catch (e) {
      setStayError(e instanceof Error ? e.message : 'Could not add the stay.');
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Stack.Screen options={{ title: name }} />
      <Row style={{ marginBottom: space.md }}>
        <Avatar name={name} size={56} vip={guest.vip} />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={{ fontSize: font.xl, fontWeight: '700', color: colors.ink }}>{name}</Text>
          <Text style={{ color: colors.muted }}>{prettyPhone(guest.phone)}</Text>
          <Row style={{ marginTop: 6, flexWrap: 'wrap' }}>
            {guest.vip ? <Badge label="VIP" tone="brass" /> : null}
            <View style={{ width: 6 }} />
            {stays.filter((s) => s.status === 'departed').length > 0 ? <Badge label={`${stays.filter((s) => s.status === 'departed').length} past stay${stays.filter((s) => s.status === 'departed').length === 1 ? '' : 's'}`} tone="brass" /> : <Badge label="First stay" tone="info" />}
            <View style={{ width: 6 }} />
            {guest.consent === 'opted_out' ? <Badge label="Opted out" tone="danger" /> : guest.consent === 'unknown' ? <Badge label="No consent yet" tone="warn" /> : <Badge label="Texting on" tone="ok" />}
          </Row>
        </View>
      </Row>

      <SectionLabel right={<Text onPress={() => setAdding(!adding)} style={{ color: colors.ink, fontWeight: '700' }}>{adding ? 'Cancel' : 'Add note'}</Text>}>What David remembers</SectionLabel>
      <Card tone={visible.length ? 'brass' : undefined}>
        {adding ? (
          <View style={{ marginBottom: space.md }}>
            <Row style={{ flexWrap: 'wrap' }}>{KINDS.map((k) => <Chip key={k} label={MEMORY_LABEL[k]!} on={k === kind} onPress={() => setKind(k)} />)}</Row>
            <Field label="About (optional)" value={key} onChangeText={setKey} placeholder="pillows, newspaper, allergy…" />
            <Field label="What to remember" value={value} onChangeText={setValue} placeholder="Firm pillows, FT every morning" />
            {addError ? <Text style={{ color: colors.danger, marginBottom: space.sm }}>{addError}</Text> : null}
            <Button label="Save" disabled={!value.trim()} onPress={addMemory} />
          </View>
        ) : null}
        {visible.length === 0 && !adding ? <Empty title="Nothing yet" body="David learns from what this guest says and asks for. You can add notes too." /> : null}
        {visible.map((m) => (
          <MemoryRow key={m.id} m={m} onHide={async () => { await patch(`/api/memories/${m.id}`, { hidden: true }); await reload(); }} />
        ))}
        {hidden.length > 0 ? <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: space.sm }}>Hidden from David: {hidden.length}</Text> : null}
        {hidden.map((m) => <MemoryRow key={m.id} m={m} onHide={async () => { await patch(`/api/memories/${m.id}`, { hidden: false }); await reload(); }} />)}
      </Card>

      <SectionLabel right={<Text onPress={() => { setStayOpen(!stayOpen); if (!arrival) { setArrival(today); setDeparture(addDays(today, 2)); } }} style={{ color: colors.ink, fontWeight: '700' }}>{stayOpen ? 'Cancel' : 'Add stay'}</Text>}>Stays</SectionLabel>
      {stayOpen ? (
        <Card>
          <Field label="Arrival" value={arrival} onChangeText={setArrival} placeholder="2026-04-02" autoCapitalize="none" />
          <Field label="Departure" value={departure} onChangeText={setDeparture} placeholder="2026-04-04" autoCapitalize="none" />
          <Field label="Room (optional)" value={room} onChangeText={setRoom} />
          {stayError ? <Text style={{ color: colors.danger, marginBottom: space.sm }}>{stayError}</Text> : null}
          <Button label="Save stay" onPress={addStay} />
        </Card>
      ) : null}
      {stays.map((s) => (
        <Card key={s.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{dateShort(s.arrival)} → {dateShort(s.departure)}</Text>
            <Badge label={s.status.replace('_', ' ')} tone={s.status === 'in_house' ? 'ok' : s.status === 'booked' ? 'info' : 'neutral'} />
          </Row>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{nights(s.arrival, s.departure)} nights{s.room ? ` · Room ${s.room}` : ''} · party of {s.partySize}</Text>
        </Card>
      ))}

      <SectionLabel>Requests</SectionLabel>
      {requests.length === 0 ? <Text style={{ color: colors.muted }}>No requests yet.</Text> : null}
      {requests.slice(0, 8).map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Badge label={REQUEST_LABEL[r.kind] ?? r.kind} tone="info" />
            <Badge label={r.status.replace('_', ' ')} tone={r.status === 'done' ? 'ok' : r.status === 'cancelled' ? 'neutral' : 'warn'} />
          </Row>
          <Text style={{ marginTop: space.sm, color: colors.text }}>{r.summary}</Text>
          <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: 2 }}>{timeAgo(r.createdAt)}</Text>
        </Card>
      ))}

      <SectionLabel>Conversation</SectionLabel>
      {thread.length === 0 ? <Text style={{ color: colors.muted }}>No messages yet.</Text> : null}
      <View>
        {thread.map((m) => {
          const mine = m.direction === 'out';
          return (
            <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <View style={{ maxWidth: '84%', backgroundColor: mine ? (m.author === 'staff' ? colors.brassSoft : colors.ink) : colors.card, borderWidth: mine ? 0 : 1, borderColor: colors.line, borderRadius: radius.lg, paddingHorizontal: 13, paddingVertical: 9 }}>
                <Text style={{ color: mine && m.author !== 'staff' ? colors.inverse : colors.text, fontSize: font.md }}>{m.body}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                {m.author === 'guest' ? 'Guest' : m.author === 'staff' ? 'You' : m.author === 'campaign' ? 'David (campaign)' : 'David'} · {timeAgo(m.createdAt)}{m.status === 'failed' ? ' · not delivered' : ''}
              </Text>
            </View>
          );
        })}
      </View>
      {guest.consent === 'opted_out' ? (
        <Text style={{ color: colors.danger, marginTop: space.sm }}>This guest opted out of texts. You can read their messages but not reply.</Text>
      ) : (
        <View style={{ marginTop: space.sm }}>
          <Field label="Reply as the hotel" value={reply} onChangeText={setReply} multiline placeholder="Your table is ready." />
          {sendError ? <Text style={{ color: colors.danger, marginBottom: space.sm }}>{sendError}</Text> : null}
          <Button label="Send text" onPress={send} loading={sending} disabled={!reply.trim()} />
        </View>
      )}
    </Screen>
  );
}
