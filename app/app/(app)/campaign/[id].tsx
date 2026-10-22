import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { del, patch, post } from '@/api/client';
import type { Campaign } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { campaignTiming, CAMPAIGN_LABEL } from '@/format';
import { colors, font, space } from '@/theme';
import { Button, Card, Chip, Field, Loading, Problem, Row, Screen, SectionLabel } from '@/ui/kit';

const KINDS = ['pre_arrival', 'arrival_day', 'mid_stay', 'post_stay', 'win_back', 'custom'] as const;
const HOURS = [8, 9, 10, 11, 12, 14, 16, 17, 18, 19, 20];

export default function CampaignEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const fresh = id === 'new';
  const { data, error, reload } = useFetch<{ campaigns: Campaign[] }>(fresh ? null : '/api/campaigns');
  const existing = data?.campaigns.find((c) => c.id === id);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('custom');
  const [offset, setOffset] = useState(0);
  const [hour, setHour] = useState(10);
  const [mode, setMode] = useState<'generated' | 'custom'>('generated');
  const [template, setTemplate] = useState('');
  const [guidance, setGuidance] = useState('');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [vipOnly, setVipOnly] = useState(false);
  const [loaded, setLoaded] = useState(fresh);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!existing || loaded) return;
    setName(existing.name); setKind(existing.kind as (typeof KINDS)[number]); setOffset(existing.offsetDays); setHour(existing.sendHour);
    setMode(existing.messageMode); setTemplate(existing.template); setGuidance(existing.guidance);
    setRepeatOnly(!!existing.audience.repeatOnly); setVipOnly(!!existing.audience.vipOnly);
    setLoaded(true);
  }, [existing, loaded]);

  if (!fresh && error && !data) return <Screen><Problem message={error} onRetry={reload} /></Screen>;
  if (!fresh && !loaded) return <Screen><Loading /></Screen>;

  const body = { name: name.trim(), enabled: existing?.enabled ?? true, offsetDays: offset, sendHour: hour, messageMode: mode, template, guidance, audience: { repeatOnly: repeatOnly || undefined, vipOnly: vipOnly || undefined } };
  const after = kind === 'post_stay' || kind === 'win_back';

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      if (fresh) await post('/api/campaigns', { ...body, kind });
      else await patch(`/api/campaigns/${id}`, body);
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function showPreview() {
    setErr(null);
    try {
      if (fresh) return setErr('Save the campaign first, then preview it.');
      await patch(`/api/campaigns/${id}`, body);
      const r = await post<{ text: string }>(`/api/campaigns/${id}/preview`, {});
      setPreview(r.text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not preview.');
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: fresh ? 'New campaign' : name || 'Campaign' }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="Spa offer" />
      {fresh ? (
        <>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>Moment in the stay</Text>
          <Row style={{ flexWrap: 'wrap' }}>{KINDS.map((k) => <Chip key={k} label={CAMPAIGN_LABEL[k]!} on={k === kind} onPress={() => setKind(k)} />)}</Row>
        </>
      ) : null}

      <SectionLabel>When</SectionLabel>
      <Card>
        <Text style={{ color: colors.muted, marginBottom: space.sm }}>{campaignTiming(kind, offset, hour)}</Text>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Days {after ? 'after departure' : offset <= 0 ? 'before arrival' : 'after arrival'}</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {(after ? [1, 2, 7, 30, 60, 75, 90] : [-7, -3, -2, -1, 0, 1, 2]).map((n) => <Chip key={n} label={n === 0 ? 'Same day' : String(Math.abs(n))} on={n === offset} onPress={() => setOffset(n)} />)}
        </Row>
        <Text style={{ fontWeight: '600', marginBottom: 6, marginTop: space.sm }}>Time (hotel's local time)</Text>
        <Row style={{ flexWrap: 'wrap' }}>{HOURS.map((h) => <Chip key={h} label={`${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`} on={h === hour} onPress={() => setHour(h)} />)}</Row>
      </Card>

      <SectionLabel>What it says</SectionLabel>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="David writes it" on={mode === 'generated'} onPress={() => setMode('generated')} />
        <Chip label="My own words" on={mode === 'custom'} onPress={() => setMode('custom')} />
      </Row>
      {mode === 'generated' ? (
        <Field label="Steer David (optional)" value={guidance} onChangeText={setGuidance} multiline placeholder="Mention the rooftop bar. Keep it short." />
      ) : (
        <>
          <Field label="Message" value={template} onChangeText={setTemplate} multiline placeholder="Hi {first_name}, welcome to {hotel}!" />
          <Text style={{ color: colors.muted, fontSize: font.sm, marginBottom: space.md }}>You can use {'{first_name}'}, {'{hotel}'}, {'{arrival}'}, {'{room}'}, {'{checkin}'} and {'{checkout}'}.</Text>
        </>
      )}

      <SectionLabel>Who gets it</SectionLabel>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Returning guests only" on={repeatOnly} onPress={() => setRepeatOnly(!repeatOnly)} />
        <Chip label="VIPs only" on={vipOnly} onPress={() => setVipOnly(!vipOnly)} />
      </Row>
      <Text style={{ color: colors.muted, fontSize: font.sm }}>Only guests who agreed to texts, ever.</Text>

      {preview ? (
        <Card tone="brass">
          <Text style={{ fontWeight: '700', marginBottom: 4 }}>Preview</Text>
          <Text style={{ color: colors.text }}>{preview}</Text>
        </Card>
      ) : null}
      {err ? <Text style={{ color: colors.danger, marginVertical: space.sm }} accessibilityRole="alert">{err}</Text> : null}
      <View style={{ marginTop: space.lg }}>
        <Button label="Save" loading={busy} disabled={!name.trim() || (mode === 'custom' && !template.trim())} onPress={save} />
        <View style={{ height: space.sm }} />
        {!fresh ? <Button label="Preview with a sample guest" variant="secondary" onPress={showPreview} /> : null}
        {!fresh ? (
          <>
            <View style={{ height: space.sm }} />
            <Button label="Delete campaign" variant="danger" onPress={async () => { await del(`/api/campaigns/${id}`); router.back(); }} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
