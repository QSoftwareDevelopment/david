import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { patch, post } from '@/api/client';
import type { RequestRow } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { REQUEST_LABEL, timeAgo } from '@/format';
import { colors, font, space } from '@/theme';
import { Badge, Button, Card, Chip, Empty, Loading, Problem, Row, Screen, Title } from '@/ui/kit';

const FILTERS = [
  { id: 'open', label: 'Open', status: 'new,in_progress' },
  { id: 'done', label: 'Done', status: 'done' },
  { id: 'all', label: 'All', status: '' },
] as const;

/** Everything guests have asked for, in the order staff should do it. */
export default function Requests() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(FILTERS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { data, error, loading, reload } = useFetch<{ requests: RequestRow[] }>(`/api/requests${filter.status ? `?status=${filter.status}` : ''}`, { pollMs: 15_000 });

  async function move(r: RequestRow, status: 'in_progress' | 'done' | 'cancelled') {
    setBusy(r.id);
    setNotice(null);
    try {
      // Telling the guest is the default: it is what they would want to hear.
      await patch(`/api/requests/${r.id}`, { status, notify: status !== 'cancelled' });
      setNotice(status === 'cancelled' ? 'Cancelled.' : `Marked ${status === 'done' ? 'done' : 'in progress'}. ${r.guestName.split(' ')[0]} has been told.`);
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update that.');
    } finally {
      setBusy(null);
    }
  }

  async function resend(r: RequestRow) {
    setBusy(r.id);
    try {
      const res = await post<{ request: RequestRow }>(`/api/requests/${r.id}/square`);
      setNotice(res.request.squareOrderId ? 'Sent to Square.' : (res.request.squareError ?? 'Could not send to Square.'));
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not send to Square.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Title sub={data ? `${data.requests.length} shown` : undefined}>Requests</Title>
      <Row style={{ flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} on={f.id === filter.id} onPress={() => setFilter(f)} />
        ))}
      </Row>
      {notice ? <Text style={{ color: colors.muted, marginBottom: space.sm }}>{notice}</Text> : null}
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.requests.length === 0 ? <Empty title="All clear" body="Nothing here right now." /> : null}
      {data?.requests.map((r) => (
        <Card key={r.id} tone={r.priority === 'urgent' && r.status !== 'done' ? 'urgent' : undefined}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Text onPress={() => router.push(`/guest/${r.guestId}`)} style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>
                {r.guestName}{r.room ? ` · Room ${r.room}` : ''}
              </Text>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>{timeAgo(r.createdAt)} · {r.createdBy === 'david' ? 'logged by David' : 'added by staff'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Badge label={REQUEST_LABEL[r.kind] ?? r.kind} tone="info" />
              {r.priority === 'urgent' ? <View style={{ marginTop: 4 }}><Badge label="Urgent" tone="danger" /></View> : null}
            </View>
          </Row>
          <Text style={{ marginTop: space.sm, color: colors.text, fontSize: font.md }}>{r.summary}</Text>
          {r.squareOrderId ? <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}><Badge label="Sent to Square" tone="ok" /></View> : null}
          {r.squareError ? (
            <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.danger, fontSize: font.sm, flexShrink: 1, marginRight: space.sm }}>{r.squareError}</Text>
              {r.kind === 'room_service' && !r.squareOrderId && (r.status === 'new' || r.status === 'in_progress') ? <Button small label="Try again" variant="secondary" loading={busy === r.id} onPress={() => resend(r)} /> : null}
            </Row>
          ) : null}
          {r.status === 'new' || r.status === 'in_progress' ? (
            <Row style={{ marginTop: space.md }}>
              {r.status === 'new' ? <Button small label="Start" variant="secondary" loading={busy === r.id} onPress={() => move(r, 'in_progress')} /> : <Badge label="In progress" tone="warn" />}
              <View style={{ width: space.sm }} />
              <Button small label="Done" loading={busy === r.id} onPress={() => move(r, 'done')} />
              <View style={{ flex: 1 }} />
              <Button small label="Cancel" variant="ghost" onPress={() => move(r, 'cancelled')} />
            </Row>
          ) : (
            <View style={{ marginTop: space.sm }}><Badge label={r.status === 'done' ? 'Done' : 'Cancelled'} tone={r.status === 'done' ? 'ok' : 'neutral'} /></View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
