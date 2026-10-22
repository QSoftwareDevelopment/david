import React, { type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, space } from '@/theme';
import { initials } from '@/format';

export function Screen({ children, scroll = true, onRefresh, refreshing, pad = true, dark = false }: { children: ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean; pad?: boolean; dark?: boolean }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[pad && s.pad, { paddingBottom: space.xxl * 2 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brass} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, pad && s.pad]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? colors.ink : colors.paper }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children, sub, right }: { children: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <View style={s.titleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.title} accessibilityRole="header">{children}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'urgent' | 'brass' }) {
  const box = [s.card, tone === 'urgent' && { borderColor: colors.danger }, tone === 'brass' && { backgroundColor: colors.brassSoft, borderColor: colors.brass }, style];
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [box, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      {children}
    </Pressable>
  ) : (
    <View style={box}>{children}</View>
  );
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, small }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; small?: boolean }) {
  const blocked = !!(loading || disabled);
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall,
        variant === 'primary' && { backgroundColor: colors.ink },
        variant === 'secondary' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        variant === 'danger' && { backgroundColor: colors.dangerSoft },
        pressed && !blocked && { opacity: 0.8 },
        blocked && { opacity: 0.5 },
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.inverse : colors.ink} /> : (
        <Text style={[s.btnText, variant === 'primary' && { color: colors.inverse }, variant === 'danger' && { color: colors.danger }, small && { fontSize: font.sm }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...input }: { label: string; error?: string | null } & TextInputProps) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...input} style={[s.input, input.multiline && { minHeight: 90, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null, input.style]} />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={[s.chip, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      <Text style={[s.chipText, on && { color: colors.inverse }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brass' | 'info' }) {
  const t = { neutral: [colors.line, colors.muted], ok: [colors.okSoft, colors.ok], warn: [colors.warnSoft, colors.warn], danger: [colors.dangerSoft, colors.danger], brass: [colors.brassSoft, colors.brassDeep], info: [colors.infoSoft, colors.info] }[tone];
  return (
    <View style={[s.badge, { backgroundColor: t[0] }]}>
      <Text style={[s.badgeText, { color: t[1] }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 40, vip }: { name: string; size?: number; vip?: boolean }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: vip ? colors.brassSoft : colors.ink }]}>
      <Text style={{ color: vip ? colors.brassDeep : colors.inverse, fontWeight: '700', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: font.lg, fontWeight: '600', color: colors.text, textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ color: colors.muted, marginTop: space.xs, textAlign: 'center' }}>{body}</Text> : null}
    </View>
  );
}

export function Problem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[s.card, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
      <Text style={{ color: colors.danger, fontWeight: '600' }}>{message}</Text>
      {onRetry ? <View style={{ marginTop: space.sm }}><Button label="Try again" onPress={onRetry} variant="secondary" small /></View> : null}
    </View>
  );
}

export function Loading() {
  return <View style={{ padding: space.xl }}><ActivityIndicator color={colors.brass} /></View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  pad: { padding: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg, marginTop: space.sm },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  sub: { color: colors.muted, marginTop: 2, fontSize: font.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm },
  section: { fontSize: font.xs, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg, marginBottom: space.md },
  btn: { minHeight: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnSmall: { minHeight: 36, paddingHorizontal: space.md },
  btnText: { fontSize: font.md, fontWeight: '600', color: colors.ink },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: space.md, paddingVertical: 12, fontSize: font.md, color: colors.text },
  error: { color: colors.danger, marginTop: 4, fontSize: font.sm },
  chip: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 7, marginRight: space.sm, marginBottom: space.sm, backgroundColor: colors.card },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: space.xxl },
});
