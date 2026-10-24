import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { patch, post } from '@/api/client';
import type { RequestRow } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { useAuth } from '@/auth/AuthProvider';
import { DEPARTMENTS, DEPARTMENT_LABEL, DEPARTMENT_OF_KIND, REQUEST_LABEL, timeAgo } from '@/format';
import { HandoffCard } from '@/ui/HandoffCard';
import { colors, font, space } from '@/theme';
import { Badge, Button, Card, Chip, Empty, Field, Loading, Problem, Row, Screen, Title } from '@/ui/kit';

const FILTERS = [
  { id: 'open', label: 'Open', status: 'new,in_progress' },
  { id: 'done', label: 'Done', status: 'done' },
  { id: 'all', label: 'All', status: '' },
] as const;

/** Everything guests have asked for, in the order staff should do it. */
export default function Requests() {
  const router = useRouter();
  const { scoped, access } = useAuth();
  const params = useLocalSearchParams<{ department?: string }>();
  const [dept, setDept] = useState<string>('');
  // Tapping a department on Today lands here already filtered.
  React.useEffect(() => { setDept(typeof params.department === 'string' ? params.department : ''); }, [params.department]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(FILTERS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [noting, setNoting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  // The front desk (and managers) send requests on to their department.
  const canSend = !scoped || access.department === 'front_desk';
  const [notice, setNotice] = useState<string | null>(null);
  const { data, error, loading, reload } = useFetch<{ requests: RequestRow[] }>(`/api/requests?${[filter.status && `status=${filter.status}`, !scoped && dept && `department=${dept}`].filter(Boolean).join('&')}`, { pollMs: 15_000 });

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

  async function send(r: RequestRow) {
    setBusy(r.id);
    setNotice(null);
    try {
      await post(`/api/requests/${r.id}/dispatch`, { note: noting === r.id && note.trim() ? note.trim() : undefined });
      setNotice(`Sent to ${DEPARTMENT_LABEL[DEPARTMENT_OF_KIND[r.kind] ?? 'front_desk']} with the guest's briefing.`);
      setNoting(null);
      setNote('');
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not send that.');
    } finally {
      setBusy(null);
    }
  }

  async function sendAll() {
    setBusy('all');
    setNotice(null);
    try {
      const r = await post<{ sent: number; failed: { error: string }[] }>('/api/requests/dispatch-all');
      setNotice(r.failed.length ? `Sent ${r.sent}. ${r.failed[0]!.error}` : `Sent ${r.sent} to their departments.`);
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not send those.');
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
      <Title sub={data ? `${data.requests.length} shown` : undefined}>{scoped && access.department ? `${DEPARTMENT_LABEL[access.department]} requests` : 'Requests'}</Title>
      <Row style={{ flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} on={f.id === filter.id} onPress={() => setFilter(f)} />
        ))}
      </Row>
      {!scoped ? (
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="Every department" on={dept === ''} onPress={() => setDept('')} />
          {DEPARTMENTS.map((d) => <Chip key={d} label={DEPARTMENT_LABEL[d]} on={dept === d} onPress={() => setDept(d)} />)}
        </Row>
      ) : null}
      {canSend && (data?.requests.filter((r) => r.dispatchedAt === null).length ?? 0) > 0 ? (
        <Card tone="brass">
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{data!.requests.filter((r) => r.dispatchedAt === null).length} waiting at the front desk</Text>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>Review each one, then send it to its department with the guest's briefing.</Text>
            </View>
            <Button small label="Send all" loading={busy === 'all'} onPress={sendAll} />
          </Row>
        </Card>
      ) : null}
      {notice ? <Text style={{ color: colors.muted, marginBottom: space.sm }}>{notice}</Text> : null}
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.requests.length === 0 ? <Empty title="All clear" body="Nothing here right now." /> : null}
      {data?.requests.map((r) => (
        <Card key={r.id} tone={r.priority === 'urgent' && r.status !== 'done' ? 'urgent' : undefined}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Text onPress={scoped ? undefined : () => router.push(`/guest/${r.guestId}`)} style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>
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
          {r.dispatchedAt === null ? <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}><Badge label={`At the front desk · not sent to ${DEPARTMENT_LABEL[DEPARTMENT_OF_KIND[r.kind] ?? 'front_desk']} yet`} tone="warn" /></View> : null}
          {r.dispatchNote ? <Text style={{ marginTop: space.sm, color: colors.text, fontSize: font.sm }}><Text style={{ fontWeight: '700' }}>Front desk note: </Text>{r.dispatchNote}</Text> : null}
          {r.confirmation ? (
            <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
              {r.confirmation.status === 'declined'
                ? <Badge label={`Declined${r.confirmation.note ? `: ${r.confirmation.note}` : ''}`} tone="danger" />
                : <Badge label={`Confirmed${[r.confirmation.table, r.confirmation.time].filter(Boolean).length ? ` · ${[r.confirmation.table, r.confirmation.time].filter(Boolean).join(' · ')}` : ''}`} tone="ok" />}
            </View>
          ) : null}
          {r.department !== 'front_desk' || r.dispatchedAt === null ? <HandoffCard requestId={r.id} /> : null}
          {canSend && r.dispatchedAt === null && (r.status === 'new' || r.status === 'in_progress') ? (
            <View style={{ marginTop: space.sm }}>
              {noting === r.id ? <Field label="Note for the team (optional)" value={note} onChangeText={setNote} placeholder="Birthday: bring a small cake" /> : null}
              <Row>
                <Button small label={`Send to ${DEPARTMENT_LABEL[DEPARTMENT_OF_KIND[r.kind] ?? 'front_desk']}`} loading={busy === r.id} onPress={() => send(r)} />
                <View style={{ width: space.sm }} />
                <Button small variant="ghost" label={noting === r.id ? 'No note' : 'Add a note'} onPress={() => { setNoting(noting === r.id ? null : r.id); setNote(''); }} />
              </Row>
            </View>
          ) : null}
          {canSend && r.confirmation?.status === 'declined' && r.status !== 'done' ? <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}><Button small variant="secondary" label="Send again" loading={busy === r.id} onPress={() => send(r)} /></View> : null}
          {r.squareOrderId ? <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}><Badge label="Sent to Square" tone="ok" /></View> : null}
          {r.squareError ? (
            <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.danger, fontSize: font.sm, flexShrink: 1, marginRight: space.sm }}>{r.squareError}</Text>
              {r.kind === 'room_service' && !r.squareOrderId && (r.status === 'new' || r.status === 'in_progress') ? <Button small label="Try again" variant="secondary" loading={busy === r.id} onPress={() => resend(r)} /> : null}
            </Row>
          ) : null}
          {(r.status === 'new' || r.status === 'in_progress') && !(canSend && r.dispatchedAt === null && DEPARTMENT_OF_KIND[r.kind] !== 'front_desk') ? (
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
