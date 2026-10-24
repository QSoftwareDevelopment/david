import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { API_URL, post, put } from '@/api/client';
import { useFetch } from '@/api/useFetch';
import { DEPARTMENT_LABEL, type Department } from '@/format';
import { colors, font, space } from '@/theme';
import { Badge, Button, Card, Field, Loading, Problem, Screen } from '@/ui/kit';

type Contact = { department: Department | 'manager'; smsNumber: string | null; webhookUrl: string | null; dispatch?: 'direct' | 'review'; integrationUrl?: string | null; hasSecret?: boolean; secretTail?: string | null };
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
  const [review, setReview] = useState(contact.dispatch === 'review');
  const [system, setSystem] = useState(contact.integrationUrl ?? '');
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'test' | 'secret' | null>(null);
  const routable = contact.department !== 'manager' && contact.department !== 'front_desk';
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setSms(contact.smsNumber ?? ''); setHook(contact.webhookUrl ?? ''); setReview(contact.dispatch === 'review'); setSystem(contact.integrationUrl ?? ''); }, [contact.smsNumber, contact.webhookUrl, contact.dispatch, contact.integrationUrl]);
  const on = !!(contact.smsNumber || contact.webhookUrl || contact.integrationUrl);

  async function save() {
    setBusy('save');
    setMsg(null);
    try {
      const r = await put<{ secret?: string }>(`/api/alerts/${contact.department}`, { smsNumber: sms.trim() || null, webhookUrl: hook.trim() || null, ...(routable ? { dispatch: review ? 'review' : 'direct', integrationUrl: system.trim() || null } : {}) });
      if (r.secret) setSecret(r.secret);
      setMsg({ ok: true, text: sms.trim() || hook.trim() || system.trim() || review ? 'Saved.' : 'Cleared.' });
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
      const r = await post<{ sent: boolean; system: { ok: boolean; error: string | null } | null }>(`/api/alerts/${contact.department}/test`);
      if (r.system && !r.system.ok) setMsg({ ok: false, text: `Their system said no: ${r.system.error}` });
      else setMsg(r.sent || r.system?.ok ? { ok: true, text: r.system?.ok ? 'Test sent, and their system answered.' : 'Test sent.' } : { ok: false, text: 'Nothing went out. Save a number or webhook first.' });
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
      {routable ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text style={{ fontWeight: '600', color: colors.text }}>Front desk sends these on</Text>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>Requests wait at the front desk until it presses Send, with the guest's briefing attached. Urgent ones go straight through.</Text>
            </View>
            <Switch value={review} onValueChange={setReview} trackColor={{ true: colors.ink, false: colors.lineStrong }} accessibilityLabel={`${LABEL(contact.department)}: front desk sends these on`} />
          </View>
          <Field label={contact.department === 'restaurant' ? "Restaurant's booking or POS system (address)" : "This team's own system (address)"} value={system} onChangeText={setSystem} autoCapitalize="none" autoCorrect={false} placeholder="https://your-system.example.com/reservations" />
          {contact.hasSecret || secret ? (
            <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: 14, padding: space.md, marginBottom: space.sm }}>
              {secret ? (
                <>
                  <Text style={{ fontWeight: '700', color: colors.text }}>Copy this secret now. It won't be shown again.</Text>
                  <Text selectable style={{ color: colors.text, marginTop: 4, fontFamily: 'Menlo' }}>{secret}</Text>
                </>
              ) : <Text style={{ color: colors.muted }}>A secret is set (ends …{contact.secretTail}). </Text>}
              <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 6 }}>
                David signs each booking he sends with it (X-David-Signature). To report back a table and time, their system posts {'{ requestId, status, table, time }'} to {API_URL}/webhooks/integrations/confirm with the header Authorization: Bearer secret.
              </Text>
              <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
                <Button small variant="secondary" label="Make a new secret" loading={busy === 'secret'} onPress={async () => { setBusy('secret'); try { setSecret((await post<{ secret: string }>(`/api/alerts/${contact.department}/secret`)).secret); onSaved(); } finally { setBusy(null); } }} />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
      {msg ? <Text style={{ color: msg.ok ? colors.ok : colors.danger, marginBottom: space.sm }} accessibilityRole={msg.ok ? 'text' : 'alert'}>{msg.text}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button small label="Save" loading={busy === 'save'} onPress={save} />
        {on ? <Button small variant="secondary" label="Send a test" loading={busy === 'test'} onPress={test} /> : null}
      </View>
    </Card>
  );
}
