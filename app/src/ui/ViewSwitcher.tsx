import React from 'react';
import { ScrollView, Text } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { DEPARTMENTS, DEPARTMENT_LABEL } from '@/format';
import { colors, font, space } from '@/theme';
import { Chip, Row } from '@/ui/kit';

/**
 * Look at the hotel the way someone else does. Owners and managers (and anyone
 * in the demo) can pick a department to see exactly what that team sees, then
 * come back. It only narrows the view: the server never gives anyone more
 * than their own role allows.
 */
export function ViewSwitcher({ compact = false }: { compact?: boolean }) {
  const { canSwitch, viewAs, setViewAs, demo, actualRole } = useAuth();
  if (!canSwitch) return null;
  const home = demo ? 'owner' : 'self';
  const current = viewAs === 'self' ? home : viewAs;
  const label = actualRole === 'owner' || demo ? 'Owner' : 'Manager';
  const chips = (
    <>
      <Chip label={label} on={current === home} onPress={() => setViewAs(demo ? 'owner' : 'self')} />
      {demo ? <Chip label="Manager" on={current === 'manager'} onPress={() => setViewAs('manager')} /> : null}
      {DEPARTMENTS.map((d) => <Chip key={d} label={DEPARTMENT_LABEL[d]} on={current === d} onPress={() => setViewAs(d)} />)}
    </>
  );
  return (
    <>
      {!compact ? <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.6, marginBottom: space.xs }}>VIEW AS</Text> : null}
      {compact ? <Row style={{ flexWrap: 'wrap' }}>{chips}</Row> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
          <Row>{chips}</Row>
        </ScrollView>
      )}
    </>
  );
}
