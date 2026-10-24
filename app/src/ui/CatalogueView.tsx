import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Catalogue, CatalogueSection } from '@/api/types';
import { dateShort, DEPARTMENT_LABEL } from '@/format';
import { colors, font, fonts, radius, shadow, space } from '@/theme';
import { Badge, Row } from '@/ui/kit';

const SECTION: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; tile: string }> = {
  food: { icon: 'restaurant-outline', tile: '#EE6A1B' },
  room: { icon: 'bed-outline', tile: '#2F7DEB' },
  housekeeping: { icon: 'sparkles-outline', tile: '#13A08A' },
  laundry: { icon: 'shirt-outline', tile: '#7A5AF8' },
  occasions: { icon: 'gift-outline', tile: '#E0457B' },
  dislikes: { icon: 'thumbs-down-outline', tile: '#64748B' },
  getting_around: { icon: 'car-outline', tile: '#2FA35A' },
  other: { icon: 'ellipsis-horizontal-circle-outline', tile: '#64748B' },
};
const SOURCE = { guest: 'They told us', observed: 'David noticed', staff: 'Added by staff' } as const;

/**
 * A guest's personal catalogue: everything we know, grouped the way each
 * department thinks about them, with where each thing came from.
 */
export function CatalogueView({ catalogue, onHide }: { catalogue: Catalogue; onHide: (memoryId: string) => void }) {
  const { stats } = catalogue;
  return (
    <View>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, marginBottom: space.md, boxShadow: shadow.card }}>
        <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.9 }}>AT A GLANCE</Text>
        {catalogue.highlights.length > 0 ? (
          <Text style={{ fontFamily: fonts.displayMedium, fontSize: 19, lineHeight: 25, color: colors.text, marginTop: space.xs }}>{catalogue.highlights.join('. ')}.</Text>
        ) : (
          <Text style={{ fontFamily: fonts.displayMedium, fontSize: 19, lineHeight: 25, color: colors.text, marginTop: space.xs }}>We're still getting to know this guest.</Text>
        )}
        <Row style={{ flexWrap: 'wrap', marginTop: space.md, gap: 6 }}>
          <Badge label={stats.pastStays > 0 ? `${stats.pastStays} past stay${stats.pastStays === 1 ? '' : 's'}` : 'First stay'} tone={stats.pastStays > 0 ? 'brass' : 'info'} />
          {stats.nights > 0 ? <Badge label={`${stats.nights} night${stats.nights === 1 ? '' : 's'} with us`} /> : null}
          {stats.requests > 0 ? <Badge label={`${stats.requests} request${stats.requests === 1 ? '' : 's'}`} /> : null}
          {stats.firstArrival ? <Badge label={`Since ${dateShort(stats.firstArrival)}`} /> : null}
        </Row>
      </View>

      {catalogue.sections.map((s) => <Section key={s.key} section={s} onHide={onHide} />)}

      {catalogue.gaps.length > 0 ? (
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, padding: space.lg, marginBottom: space.md }}>
          <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.9 }}>WORTH ASKING NEXT</Text>
          {catalogue.gaps.map((g) => <Text key={g} style={{ color: colors.text, fontSize: font.md, marginTop: 4 }}>• {g}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

function Section({ section, onHide }: { section: CatalogueSection; onHide: (memoryId: string) => void }) {
  const look = SECTION[section.key] ?? SECTION.other!;
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, marginBottom: space.md, boxShadow: shadow.card }}>
      <Row style={{ marginBottom: space.sm }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: look.tile, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={look.icon} size={18} color="#fff" />
        </View>
        <Text style={{ fontFamily: fonts.displayMedium, fontSize: 19, color: colors.text, marginLeft: space.sm, flex: 1 }}>{section.title}</Text>
        {section.department ? <Text style={{ color: colors.muted, fontSize: font.xs }}>{DEPARTMENT_LABEL[section.department]}</Text> : null}
      </Row>

      {section.lines.map((l) => (
        <View key={l.memoryId} style={{ paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: font.md }}>{l.text}</Text>
              <Text style={{ color: colors.muted, fontSize: font.xs, marginTop: 2 }}>{SOURCE[l.source]}{l.sure ? '' : ' · not certain yet'}</Text>
            </View>
            <Pressable onPress={() => onHide(l.memoryId)} accessibilityRole="button" accessibilityLabel={`Hide: ${l.text}`} hitSlop={10}>
              <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: '600' }}>Hide</Text>
            </Pressable>
          </Row>
        </View>
      ))}

      {section.orders.length > 0 ? (
        <View style={{ paddingTop: space.sm, borderTopWidth: section.lines.length ? 1 : 0, borderTopColor: colors.line }}>
          <Text style={{ color: colors.muted, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.9, marginBottom: 6 }}>WHAT THEY ACTUALLY ORDER</Text>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {section.orders.map((o) => <Badge key={o.item} label={o.count > 1 ? `${o.item} ×${o.count}` : o.item} tone="neutral" />)}
          </Row>
        </View>
      ) : null}

      {section.facts.map((f) => <Text key={f} style={{ color: colors.muted, fontSize: font.sm, marginTop: space.sm }}>{f}</Text>)}
    </View>
  );
}
