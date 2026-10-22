import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { del, post, put } from '@/api/client';
import type { SquareStatus } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { timeAgo } from '@/format';
import { colors, font, space } from '@/theme';
import { Badge, Button, Card, Chip, Field, Row, Screen, SectionLabel } from '@/ui/kit';

type Result = { added: number; updated: number; hidden: number; square: SquareStatus };

/**
 * Connect the hotel's Square. David reads the room service menu from it and
 * sends each confirmed order to it, so the kitchen sees one queue.
 */
export default function Square() {
  const { hotel, refresh } = useAuth();
  const status = hotel?.square;
  const [token, setToken] = useState('');
  const [location, setLocation] = useState('');
  const [env, setEnv] = useState<'production' | 'sandbox'>('production');
  const [busy, setBusy] = useState<'connect' | 'sync' | 'off' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (status) { setLocation(status.locationId ?? ''); setEnv(status.environment); }
  }, [status?.locationId, status?.environment]);

  const summary = (r: Result) => `Menu synced: ${r.added} added, ${r.updated} updated${r.hidden ? `, ${r.hidden} hidden` : ''}.`;

  async function run<T>(kind: 'connect' | 'sync' | 'off', fn: () => Promise<T>, done: (r: T) => string) {
    setBusy(kind);
    setMsg(null);
    try {
      const r = await fn();
      await refresh();
      setMsg({ ok: true, text: done(r) });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>Square</Text>
          <Badge label={status?.connected ? 'Connected' : 'Not connected'} tone={status?.connected ? 'ok' : 'neutral'} />
        </Row>
        <Text style={{ color: colors.muted, marginTop: space.sm }}>
          {status?.connected
            ? `Room service comes from your Square catalog${status.syncedAt ? ` (synced ${timeAgo(status.syncedAt)})` : ''}. Each order a guest confirms is sent to Square as an open order, with the room, the guest's first name and any allergy on it.`
            : 'Connect Square and David will offer the items from your Square catalog and send each room service order to your kitchen there.'}
        </Text>
      </Card>

      <SectionLabel>{status?.connected ? 'Connection' : 'Connect'}</SectionLabel>
      <Field label={status?.connected ? 'Access token (leave blank to keep the saved one)' : 'Access token'} value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="EAAA..." />
      <Field label="Location ID" value={location} onChangeText={setLocation} autoCapitalize="none" autoCorrect={false} placeholder="L8XXXXXXXXXXX" />
      <Row style={{ marginBottom: space.md }}>
        <Chip label="Live" on={env === 'production'} onPress={() => setEnv('production')} />
        <Chip label="Sandbox (testing)" on={env === 'sandbox'} onPress={() => setEnv('sandbox')} />
      </Row>
      <Text style={{ color: colors.muted, marginBottom: space.md, fontSize: font.sm }}>
        In the Square Developer Dashboard, create an application and copy its access token. Give it permission to read items and write orders. The location ID is under Locations. The token is stored on David's server and never shown again.
      </Text>
      {msg ? <Text style={{ color: msg.ok ? colors.ok : colors.danger, marginBottom: space.sm }} accessibilityRole={msg.ok ? 'text' : 'alert'}>{msg.text}</Text> : null}
      <Button
        label={status?.connected ? 'Save and sync menu' : 'Connect and import menu'}
        loading={busy === 'connect'}
        disabled={!location.trim() || (!status?.connected && !token.trim())}
        onPress={() => run('connect', () => put<Result>('/api/square', { accessToken: token.trim() || undefined, locationId: location.trim(), environment: env }), (r) => { setToken(''); return summary(r); })}
      />
      {status?.connected ? (
        <View style={{ marginTop: space.md }}>
          <Button label="Sync menu now" variant="secondary" loading={busy === 'sync'} onPress={() => run('sync', () => post<Result>('/api/square/sync'), summary)} />
          <View style={{ height: space.sm }} />
          <Button label="Disconnect" variant="ghost" loading={busy === 'off'} onPress={() => run('off', () => del('/api/square'), () => 'Disconnected. Your menu items stay; orders stop going to Square.')} />
        </View>
      ) : null}
      <Text style={{ color: colors.muted, marginTop: space.lg, fontSize: font.sm }}>
        Only room service goes to Square. Items you added by hand stay as they are, and anything not in Square is flagged on the request so the kitchen still gets it.
      </Text>
    </Screen>
  );
}
