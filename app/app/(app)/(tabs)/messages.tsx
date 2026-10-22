import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import type { Conversation } from '@/api/types';
import { useFetch } from '@/api/useFetch';
import { timeAgo } from '@/format';
import { colors, font, space } from '@/theme';
import { Avatar, Badge, Card, Empty, Loading, Problem, Row, Screen, Title } from '@/ui/kit';

const WHO = { guest: '', david: 'David: ', staff: 'You: ', campaign: 'David: ' } as const;

export default function Messages() {
  const router = useRouter();
  const { data, error, loading, reload } = useFetch<{ conversations: Conversation[] }>('/api/conversations', { pollMs: 8_000 });
  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      <Title sub="Every text between guests and David">Messages</Title>
      {error && !data ? <Problem message={error} onRetry={reload} /> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.conversations.length === 0 ? <Empty title="No messages yet" body="When a guest texts the hotel's number, it appears here." /> : null}
      {data?.conversations.map((c) => (
        <Card key={c.guestId} onPress={() => router.push(`/guest/${c.guestId}`)}>
          <Row>
            <Avatar name={c.guestName} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{c.guestName}</Text>
                <Text style={{ color: colors.muted, fontSize: font.xs }}>{timeAgo(c.last.createdAt)}</Text>
              </Row>
              <Text numberOfLines={2} style={{ color: colors.muted, marginTop: 2 }}>
                {WHO[c.last.author]}{c.last.body}
              </Text>
              <Row style={{ marginTop: 6 }}>
                {c.openRequests > 0 ? <Badge label={`${c.openRequests} open`} tone="info" /> : null}
                {c.consent === 'opted_out' ? <Badge label="Opted out" tone="danger" /> : null}
              </Row>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
