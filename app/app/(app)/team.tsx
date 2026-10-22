import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { del, patch, post } from '@/api/client';
import type { Department, Team, TeamMember } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { DEPARTMENTS, DEPARTMENT_LABEL } from '@/format';
import { colors, font, space } from '@/theme';
import { Badge, Button, Card, Chip, Field, Loading, Problem, Row, Screen, SectionLabel } from '@/ui/kit';

const roleLabel = (m: { role: string; department: Department | null }) =>
  m.role === 'owner' ? 'Owner' : m.role === 'manager' ? 'Manager, sees everything' : m.department ? DEPARTMENT_LABEL[m.department] : 'Sees everything';

/**
 * Who works here and what they can see. A manager sees the whole hotel; a
 * department sees its own requests and nothing about guests.
 */
export default function TeamScreen() {
  const { data, error, reload } = useFetch<Team>('/api/team');
  const [email, setEmail] = useState('');
  const [who, setWho] = useState<'manager' | Department>('room_service');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  const body = (v: 'manager' | Department) => (v === 'manager' ? { role: 'manager', department: null } : { role: 'staff', department: v });
  const options = (on: string, set: (v: 'manager' | Department) => void) => (
    <Row style={{ flexWrap: 'wrap' }}>
      <Chip label="Manager (everything)" on={on === 'manager'} onPress={() => set('manager')} />
      {DEPARTMENTS.map((d) => <Chip key={d} label={DEPARTMENT_LABEL[d]} on={on === d} onPress={() => set(d)} />)}
    </Row>
  );

  return (
    <Screen onRefresh={reload}>
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {msg ? <Text style={{ color: msg.ok ? colors.ok : colors.danger, marginBottom: space.sm }} accessibilityRole={msg.ok ? 'text' : 'alert'}>{msg.text}</Text> : null}

      <SectionLabel>Invite someone</SectionLabel>
      <Card>
        <Field label="Their email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="chef@yourhotel.com" />
        <Text style={{ fontWeight: '600', color: colors.text, marginBottom: space.xs }}>What they can see</Text>
        {options(who, setWho)}
        <Text style={{ color: colors.muted, fontSize: font.sm, marginVertical: space.sm }}>
          {who === 'manager' ? 'Sees every department, guests, messages and settings.' : `Sees only ${DEPARTMENT_LABEL[who as Department].toLowerCase()} requests, and can mark them started or done. No guest profiles or messages.`}
          {' '}They join when they sign in with this email.
        </Text>
        <Button label="Send invite" disabled={!email.includes('@')} loading={busy} onPress={() => run(async () => { await post('/api/team/invites', { email: email.trim(), ...body(who) }); setEmail(''); }, 'Invited. They get access when they sign in with that email.')} />
      </Card>

      {data && data.invites.length > 0 ? (
        <>
          <SectionLabel>Waiting to sign in</SectionLabel>
          {data.invites.map((i) => (
            <Card key={i.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{i.email}</Text>
                  <Text style={{ color: colors.muted, fontSize: font.sm }}>{roleLabel(i)}</Text>
                </View>
                <Button small variant="ghost" label="Cancel" onPress={() => run(() => del(`/api/team/invites/${i.id}`), 'Invite cancelled.')} />
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      {data ? <SectionLabel>On the team</SectionLabel> : null}
      {data?.members.map((m: TeamMember) => (
        <Card key={m.userId}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{m.email ?? 'Signed in'}</Text>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>{roleLabel(m)}</Text>
            </View>
            {m.role === 'owner' ? <Badge label="Owner" tone="brass" /> : <Button small variant="ghost" label={editing === m.userId ? 'Close' : 'Change'} onPress={() => setEditing(editing === m.userId ? null : m.userId)} />}
          </Row>
          {editing === m.userId ? (
            <View style={{ marginTop: space.sm }}>
              {options(m.role === 'manager' ? 'manager' : (m.department ?? ''), (v) => run(() => patch(`/api/team/${m.userId}`, body(v)), 'Updated.'))}
              <View style={{ height: space.sm }} />
              <Button small variant="danger" label="Remove from team" onPress={() => run(async () => { await del(`/api/team/${m.userId}`); setEditing(null); }, 'Removed.')} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
