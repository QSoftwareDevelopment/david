import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { get } from '@/api/client';
import type { Handoff } from '@/api/types';
import { colors, font, space } from '@/theme';

/** The briefing that travels with a request: the ask, plus what we know about the guest that the department acts on. */
export function HandoffCard({ requestId, label = 'Guest briefing' }: { requestId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !lines) {
      try {
        setLines((await get<{ handoff: Handoff }>(`/api/requests/${requestId}/handoff`)).handoff.lines.slice(1));
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load the briefing.');
      }
    }
  }

  return (
    <View style={{ marginTop: space.sm }}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={8}>
        <Text style={{ color: colors.ink, fontWeight: '700', fontSize: font.sm }}>{open ? '▾' : '▸'} {label}</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: space.sm, backgroundColor: colors.surfaceMuted, borderRadius: 14, padding: space.md }}>
          {err ? <Text style={{ color: colors.danger }}>{err}</Text> : null}
          {!lines && !err ? <Text style={{ color: colors.muted }}>Loading…</Text> : null}
          {lines?.map((l, i) => {
            const [head, ...rest] = l.split(': ');
            return (
              <Text key={i} style={{ color: colors.text, fontSize: font.sm, marginTop: i ? 4 : 0 }}>
                <Text style={{ fontWeight: '700' }}>{rest.length ? `${head}: ` : ''}</Text>{rest.length ? rest.join(': ') : l}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
