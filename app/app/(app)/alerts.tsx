import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { post, put } from '@/api/client';
import { useFetch } from '@/api/useFetch';
import { DEPARTMENT_LABEL, type Department } from '@/format';
import { colors, font, space } from '@/theme';
import { Badge, Button, Card, Field, Loading, Problem, Screen } from '@/ui/kit';

type Contact = { department: Department | 'manager'; smsNumber: string | null; webhookUrl: string | null };
type View_ = { contacts: Contact[]; briefingHour: number };

const LABEL = (d: Contact['department']) => (d === 'manager' ? 'Manager' : DEPARTMENT_LABEL[d]);
const ABOUT = (d: Contact['department']) => (d === 'manager' ? 'Escalations, urgent requests, and the morning briefing.' : 'New requests for this department.');

/**
 * Where David tells people. Hotels already have a kitchen phone, a Slack channel
 * and a duty manager, so David texts or posts there. Staff never have to open
 * this app to do their job.
 */
export default function Alerts() {
  const { data, error, reload } = useFetch<View_>('/api/alerts');
  return (
    <Screen onRefresh={reload}>
      <Text style={{ color: colors.muted, marginBottom: space.md }}>
        David sends each request to where your team already looks: a phone that gets a text, a Slack or Teams channel, or both. If nobody picks something up in time he nudges the department once, then tells the manager.
      </Text>
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data?.contacts.map((c) => <ContactCard key={c.department} contact={c} onSaved={reload} />)}
    </Screen>
  );
}

function ContactCard({ contact, onSaved }: { contact: Contact; onSaved: () => void }) {
  const [sms, setSms] = useState(contact.smsNumber ?? '');
  const [hook, setHook] = useState(contact.webhookUrl ?? '');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setSms(contact.smsNumber ?? ''); setHook(contact.webhookUrl ?? ''); }, [contact.smsNumber, contact.webhookUrl]);
  const on = !!(contact.smsNumber || contact.webhookUrl);

  async function save() {
    setBusy('save');
    setMsg(null);
    try {
      await put(`/api/alerts/${contact.department}`, { smsNumber: sms.trim() || null, webhookUrl: hook.trim() || null });
      setMsg({ ok: true, text: sms.trim() || hook.trim() ? 'Saved.' : 'Cleared.' });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(null);
    }
  }
  async function test() {
    setBusy('test');
    setMsg(null);
    try {
      const r = await post<{ sent: boolean }>(`/api/alerts/${contact.department}/test`);
      setMsg(r.sent ? { ok: true, text: 'Test sent.' } : { ok: false, text: 'Nothing went out. Save a number or webhook first.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not send.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{LABEL(contact.department)}</Text>
        <Badge label={on ? 'On' : 'Off'} tone={on ? 'ok' : 'neutral'} />
      </View>
      <Text style={{ color: colors.muted, fontSize: font.sm, marginBottom: space.sm }}>{ABOUT(contact.department)}</Text>
      <Field label="Text this phone" value={sms} onChangeText={setSms} keyboardType="phone-pad" placeholder="+1 416 555 0100" />
      <Field label="Post to a webhook (Slack, Teams)" value={hook} onChangeText={setHook} autoCapitalize="none" autoCorrect={false} placeholder="https://hooks.slack.com/services/..." />
      {msg ? <Text style={{ color: msg.ok ? colors.ok : colors.danger, marginBottom: space.sm }} accessibilityRole={msg.ok ? 'text' : 'alert'}>{msg.text}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button small label="Save" loading={busy === 'save'} onPress={save} />
        {on ? <Button small variant="secondary" label="Send a test" loading={busy === 'test'} onPress={test} /> : null}
      </View>
    </Card>
  );
}
