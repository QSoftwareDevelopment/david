import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { patch } from '@/api/client';
import type { Campaign } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { campaignTiming, CAMPAIGN_LABEL } from '@/format';
import { colors, font, space } from '@/theme';
import { Badge, Button, Card, Empty, Loading, Problem, Row, Screen } from '@/ui/kit';

export default function Campaigns() {
  const router = useRouter();
  const { data, error, loading, reload } = useFetch<{ campaigns: Campaign[] }>('/api/campaigns');
  const [err, setErr] = useState<string | null>(null);

  async function toggle(c: Campaign, enabled: boolean) {
    setErr(null);
    try {
      await patch(`/api/campaigns/${c.id}`, { enabled });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not change that.');
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Text style={{ color: colors.muted, marginBottom: space.lg, fontSize: font.md }}>
        These are the texts David sends first. Each goes out at the hotel's local time, only to guests who agreed to texts, never in quiet hours, and at most one a day per guest.
      </Text>
      {err ? <Problem message={err} /> : null}
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.campaigns.length === 0 ? <Empty title="No campaigns yet" /> : null}
      {data?.campaigns.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/campaign/${c.id}`)}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{c.name}</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>{CAMPAIGN_LABEL[c.kind]} · {campaignTiming(c.kind, c.offsetDays, c.sendHour)}</Text>
            </View>
            <Switch value={c.enabled} onValueChange={(v) => toggle(c, v)} trackColor={{ true: colors.ink, false: colors.lineStrong }} accessibilityLabel={`${c.name} on or off`} />
          </Row>
          <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
            <Badge label={c.messageMode === 'generated' ? 'Written by David' : 'Your words'} tone={c.messageMode === 'generated' ? 'brass' : 'neutral'} />
            <View style={{ width: 6 }} />
            <Badge label={`${c.sent} sent`} tone="ok" />
            {c.audience.repeatOnly ? <><View style={{ width: 6 }} /><Badge label="Returning guests" tone="info" /></> : null}
            {c.audience.vipOnly ? <><View style={{ width: 6 }} /><Badge label="VIPs" tone="info" /></> : null}
          </Row>
        </Card>
      ))}
      <View style={{ marginTop: space.md }}>
        <Button label="New campaign" variant="secondary" onPress={() => router.push('/campaign/new')} />
      </View>
    </Screen>
  );
}
