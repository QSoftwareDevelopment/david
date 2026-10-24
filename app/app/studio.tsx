import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { isDemoMode } from '@/auth/AuthProvider';
import { colors, fonts } from '@/theme';

/**
 * The studio: every stakeholder's view of David, side by side with a menu.
 *
 * Web only, and only against a demo server. Each phone is the real app (the
 * same code Expo Go runs) in an iframe, opened as one person, so you can click
 * between the owner, the kitchen, the front desk and the guest without
 * switching accounts on a phone. The sign-in here is a stand-in: any email
 * and password get you in.
 */

type Item = { id: string; label: string; blurb: string; icon: React.ComponentProps<typeof Ionicons>['name']; path: string; as: string; frame?: 'tablet' };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Stakeholders',
    items: [
      { id: 'owner', label: 'Owner / GM', blurb: 'Everything: every department at a glance, arrivals, guests, alerts and the team.', icon: 'business-outline', path: '/', as: 'owner' },
      { id: 'manager', label: 'Concierge / manager', blurb: 'The whole hotel, without owner-only settings.', icon: 'ribbon-outline', path: '/', as: 'manager' },
      { id: 'front_desk', label: 'Front desk', blurb: "Today's arrivals with what they asked for and how to make the stay theirs, plus their own queue.", icon: 'key-outline', path: '/', as: 'front_desk' },
      { id: 'room_service', label: 'Kitchen / room service', blurb: 'Room service orders, with allergies on every ticket.', icon: 'restaurant-outline', path: '/', as: 'room_service' },
      { id: 'restaurant', label: 'Restaurant host', blurb: 'Table requests from guests, with their occasions.', icon: 'wine-outline', path: '/', as: 'restaurant' },
      { id: 'housekeeping', label: 'Housekeeping', blurb: 'Towels, pillows, turn-down and amenities.', icon: 'sparkles-outline', path: '/', as: 'housekeeping' },
      { id: 'laundry', label: 'Laundry', blurb: 'Pickups and pressing, with the promised time.', icon: 'shirt-outline', path: '/', as: 'laundry' },
      { id: 'maintenance', label: 'Maintenance', blurb: 'Anything broken, with the room it is in.', icon: 'construct-outline', path: '/', as: 'maintenance' },
    ],
  },
  {
    title: 'Guests',
    items: [
      { id: 'catalogue', label: 'Guest catalogue', blurb: 'Everyone we know. Tap a guest for their personal card: food, room, housekeeping, laundry, occasions.', icon: 'people-outline', path: '/guests', as: 'owner' },
      { id: 'phone', label: 'Guest phone', blurb: 'Text David as a guest, by SMS or WhatsApp, and watch the app react.', icon: 'chatbubble-ellipses-outline', path: '/simulator', as: 'owner' },
    ],
  },
  {
    title: 'Their systems',
    items: [{ id: 'pos', label: 'Restaurant system', blurb: "The restaurant's own booking and POS software (a demo stand-in): the floor map, the tables booked, and everything David sent with each booking.", icon: 'map-outline', path: '/pos', as: 'owner', frame: 'tablet' }],
  },
  {
    title: 'Screens',
    items: [{ id: 'signin', label: 'Sign-in', blurb: 'What staff see when they open the app.', icon: 'log-in-outline', path: '/sign-in?preview=1', as: 'owner' }],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

const PHONE = { w: 390, h: 844 };
const TABLET = { w: 960, h: 640 };
const sizeOf = (i: Item) => (i.frame === 'tablet' ? TABLET : PHONE);
const BEZEL = 12;
const KEY = 'david-studio-signed-in';

const read = () => { try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
const write = (on: boolean) => { try { on ? window.sessionStorage.setItem(KEY, '1') : window.sessionStorage.removeItem(KEY); } catch { /* private window */ } };

export default function Studio() {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setSignedIn(read()); setReady(true); }, []);

  if (Platform.OS !== 'web') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>The studio is a web page. Open it in a browser.</Text></View>;
  if (!isDemoMode()) return <Note>The studio runs against a demo server. Open this page with <Text style={{ fontWeight: '700' }}>?demo=1</Text> on the end.</Note>;
  if (!ready) return null;
  if (!signedIn) return <Login onDone={() => { write(true); setSignedIn(true); }} />;
  return <Workspace onSignOut={() => { write(false); setSignedIn(false); }} />;
}

function Note({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 32 }}><Text style={{ color: colors.text, fontSize: 17, textAlign: 'center' }}>{children}</Text></View>;
}

function Login({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const [email, setEmail] = useState('gm@harbourhouse.ca');
  const [password, setPassword] = useState('demo-password');
  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.paper }}>
      <View style={{ flex: wide ? 1.1 : undefined, backgroundColor: colors.ink, padding: wide ? 56 : 28, justifyContent: 'center' }}>
        <Text style={{ color: colors.brass, fontSize: 12, letterSpacing: 3, fontWeight: '700' }}>DAVID</Text>
        <Text style={{ color: '#fff', fontFamily: fonts.accent, fontSize: wide ? 52 : 36, lineHeight: wide ? 54 : 38, letterSpacing: -1.6, marginTop: 8 }}>The concierge{'\n'}who remembers.</Text>
        <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 25, marginTop: 16, maxWidth: 460 }}>
          Guests text David. He handles room service, housekeeping and laundry, tells the right team where they already look, and remembers every habit so each return feels curated.
        </Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ width: '100%', maxWidth: 400 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: -0.8 }}>Sign in</Text>
          <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 20 }}>Studio preview. Any email and password work for now.</Text>
          <Text style={{ fontWeight: '600', color: colors.text, marginBottom: 6 }}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={fieldStyle} />
          <Text style={{ fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 14 }}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry style={fieldStyle} onSubmitEditing={onDone} />
          <Pressable onPress={onDone} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 22, backgroundColor: pressed ? colors.crimsonPressed : colors.ink, borderRadius: 999, paddingVertical: 15, alignItems: 'center' })}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Sign in</Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 14 }}>The real app signs in with the hotel's own accounts.</Text>
        </View>
      </View>
    </View>
  );
}
const fieldStyle = { backgroundColor: colors.surfaceMuted, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.text } as const;

function Workspace({ onSignOut }: { onSignOut: () => void }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 860;
  const [id, setId] = useState('owner');
  const [withGuest, setWithGuest] = useState(false);
  const item = ALL.find((i) => i.id === id)!;
  const guest = ALL.find((i) => i.id === 'phone')!;

  // Fit the phone(s) to the window.
  const phones = withGuest && id !== 'phone' ? 2 : 1;
  const avail = { w: width - (wide ? 288 : 0) - 48, h: height - (wide ? 120 : 190) };
  const dims = sizeOf(item);
  const full = { w: dims.w + BEZEL * 2, h: dims.h + BEZEL * 2 };
  const scale = Math.max(0.35, Math.min(1, avail.h / full.h, avail.w / (full.w * phones + (phones - 1) * 32)));

  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.paper }}>
      {wide ? (
        <View style={{ width: 288, backgroundColor: colors.burgundy, paddingVertical: 24 }}>
          <View style={{ paddingHorizontal: 22, marginBottom: 16 }}>
            <Text style={{ color: colors.brass, fontSize: 12, letterSpacing: 3, fontWeight: '700' }}>DAVID</Text>
            <Text style={{ color: '#fff', fontFamily: fonts.display, fontSize: 22, marginTop: 4 }}>Studio</Text>
          </View>
          <ScrollView>
            {GROUPS.map((g) => (
              <View key={g.title} style={{ marginBottom: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 22, marginBottom: 6 }}>{g.title.toUpperCase()}</Text>
                {g.items.map((i) => {
                  const on = i.id === id;
                  return (
                    <Pressable key={i.id} onPress={() => setId(i.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 22, backgroundColor: on ? 'rgba(255,255,255,0.12)' : 'transparent', borderLeftWidth: 3, borderLeftColor: on ? colors.brass : 'transparent' }}>
                      <Ionicons name={i.icon} size={19} color={on ? colors.brass : 'rgba(255,255,255,0.8)'} />
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: on ? '700' : '500', marginLeft: 12 }}>{i.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onSignOut} style={{ paddingHorizontal: 22, paddingVertical: 12 }} accessibilityRole="button">
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '600' }}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView horizontal style={{ flexGrow: 0, backgroundColor: colors.burgundy }} contentContainerStyle={{ padding: 10, gap: 8 }}>
          {ALL.map((i) => (
            <Pressable key={i.id} onPress={() => setId(i.id)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: i.id === id ? colors.brass : 'rgba(255,255,255,0.14)' }}>
              <Text style={{ color: i.id === id ? '#1B1416' : '#fff', fontWeight: '600' }}>{i.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: -0.5 }}>{item.label}</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }} numberOfLines={2}>{item.blurb}</Text>
          </View>
          {id !== 'phone' && id !== 'signin' ? (
            <Pressable onPress={() => setWithGuest(!withGuest)} accessibilityRole="button" accessibilityState={{ selected: withGuest }} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: withGuest ? colors.ink : colors.card, borderWidth: 1, borderColor: withGuest ? colors.ink : colors.line }}>
              <Text style={{ fontWeight: '600', color: withGuest ? '#fff' : colors.text }}>{withGuest ? 'Guest phone: on' : 'Show guest phone'}</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ flexDirection: 'row', gap: 32, alignItems: 'flex-start' }}>
            <Phone item={item} scale={scale} />
            {phones === 2 ? <Phone item={guest} scale={scale} /> : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/** One phone: the real app in a frame, opened as one person. */
function Phone({ item, scale }: { item: Item; scale: number }) {
  const src = useMemo(() => {
    const url = new URL(item.path, window.location.origin);
    url.searchParams.set('demo', '1');
    url.searchParams.set('as', item.as);
    return url.toString();
  }, [item]);
  const dims = sizeOf(item);
  const tablet = item.frame === 'tablet';
  const outer = { w: (dims.w + BEZEL * 2) * scale, h: (dims.h + BEZEL * 2) * scale };
  return (
    <View style={{ width: outer.w, height: outer.h }}>
      <View style={{ width: dims.w + BEZEL * 2, height: dims.h + BEZEL * 2, transform: [{ scale }], transformOrigin: 'top left' as never, backgroundColor: '#14101a', borderRadius: tablet ? 34 : 58, padding: BEZEL, boxShadow: '0 24px 60px rgba(40, 10, 20, 0.28)' }}>
        <View style={{ flex: 1, borderRadius: tablet ? 24 : 46, overflow: 'hidden', backgroundColor: colors.paper }}>
          {/* The status-bar strip, so the app's header clears the camera island like it does on a real phone. */}
          {tablet ? null : <View style={{ height: 40, backgroundColor: colors.paper }} />}
          <View style={{ flex: 1 }}>
            {React.createElement('iframe', { key: src, src, title: item.label, style: { width: '100%', height: '100%', border: 0, display: 'block' } })}
          </View>
          {tablet ? null : <View pointerEvents="none" style={{ position: 'absolute', top: 10, alignSelf: 'center', width: 112, height: 30, borderRadius: 20, backgroundColor: '#14101a' }} />}
        </View>
      </View>
    </View>
  );
}
