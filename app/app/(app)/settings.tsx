import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { patch } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { colors, font, space } from '@/theme';
import { Button, Chip, Field, Row, Screen, SectionLabel } from '@/ui/kit';

const TONES = ['warm, polished and brief', 'friendly and relaxed', 'formal and refined', 'playful and upbeat'];

export default function Settings() {
  const { hotel, refresh } = useAuth();
  const [name, setName] = useState('');
  const [tone, setTone] = useState('');
  const [signature, setSignature] = useState('');
  const [number, setNumber] = useState('');
  const [quietStart, setQuietStart] = useState('21');
  const [quietEnd, setQuietEnd] = useState('8');
  const [checkin, setCheckin] = useState('15:00');
  const [checkout, setCheckout] = useState('11:00');
  const [reviewUrl, setReviewUrl] = useState('');
  const [briefing, setBriefing] = useState('7');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!hotel) return;
    setName(hotel.name); setTone(hotel.tone); setSignature(hotel.signature); setNumber(hotel.smsNumber ?? '');
    setQuietStart(String(hotel.quietStart)); setQuietEnd(String(hotel.quietEnd)); setCheckin(hotel.checkinTime); setCheckout(hotel.checkoutTime);
    setReviewUrl(hotel.reviewUrl ?? ''); setBriefing(String(hotel.briefingHour ?? 7));
  }, [hotel]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await patch('/api/hotel', { name: name.trim(), tone: tone.trim(), signature: signature.trim(), smsNumber: number.trim() || null, quietStart: Number(quietStart), quietEnd: Number(quietEnd), checkinTime: checkin, checkoutTime: checkout, reviewUrl: reviewUrl.trim() || null, briefingHour: Number(briefing) });
      await refresh();
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field label="Hotel name" value={name} onChangeText={setName} />
      <SectionLabel>David's voice</SectionLabel>
      <Row style={{ flexWrap: 'wrap' }}>{TONES.map((t) => <Chip key={t} label={t} on={tone === t} onPress={() => setTone(t)} />)}</Row>
      <Field label="Or describe it" value={tone} onChangeText={setTone} multiline />
      <Field label="Sign-off on every text (optional)" value={signature} onChangeText={setSignature} placeholder="- David" />
      <SectionLabel>Texting</SectionLabel>
      <Field label="Hotel's texting number" value={number} onChangeText={setNumber} keyboardType="phone-pad" placeholder="+1 416 555 0100" />
      <Text style={{ color: colors.muted, marginTop: -space.sm, marginBottom: space.md, fontSize: font.sm }}>The Twilio number guests text. Point its messaging webhook at your David server.</Text>
      <Row>
        <Field label="Quiet from (hour)" value={quietStart} onChangeText={setQuietStart} keyboardType="number-pad" style={{ width: 120 }} />
        <Text style={{ width: space.md }} />
        <Field label="Until (hour)" value={quietEnd} onChangeText={setQuietEnd} keyboardType="number-pad" style={{ width: 120 }} />
      </Row>
      <Text style={{ color: colors.muted, marginTop: -space.sm, marginBottom: space.md, fontSize: font.sm }}>David never texts first during these hours, in the hotel's local time.</Text>
      <SectionLabel>Times</SectionLabel>
      <Row>
        <Field label="Check-in" value={checkin} onChangeText={setCheckin} style={{ width: 120 }} />
        <Text style={{ width: space.md }} />
        <Field label="Check-out" value={checkout} onChangeText={setCheckout} style={{ width: 120 }} />
      </Row>
      <SectionLabel>Feedback</SectionLabel>
      <Field label="Review link" value={reviewUrl} onChangeText={setReviewUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://g.page/r/your-hotel/review" />
      <Text style={{ color: colors.muted, marginTop: -space.sm, marginBottom: space.md, fontSize: font.sm }}>When a guest rates their stay 9 or 10 after they leave, David sends them here. Anyone who scores 6 or lower is passed to your duty manager instead.</Text>
      <Field label="Morning briefing at (hour, 0 to 23)" value={briefing} onChangeText={setBriefing} keyboardType="number-pad" style={{ width: 120 }} />
      <Text style={{ color: colors.muted, marginTop: -space.sm, marginBottom: space.md, fontSize: font.sm }}>The manager gets a short text each morning: who is arriving, what they asked for, who is late. Set the manager's number under More, Alerts.</Text>
      {msg ? <Text style={{ color: msg.ok ? colors.ok : colors.danger, marginBottom: space.sm }} accessibilityRole={msg.ok ? 'text' : 'alert'}>{msg.text}</Text> : null}
      <Button label="Save changes" loading={busy} onPress={save} />
    </Screen>
  );
}
