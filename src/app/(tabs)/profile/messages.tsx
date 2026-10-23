/** Profile > Messages — the in-app inbox for notices sent from Admin > Notifications. */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../../components/AppText';
import { Card, Page } from '../../../components/ui';
import { useApp } from '../../../state/AppState';
import { getMyMessages, markMessagesRead } from '../../../services/promos';
import { fmtSentAt } from '../../../services/scheduling';
import { clearUnreadMessages } from '../../../state/unreadMessages';
import type { InboxMessage } from '../../../models';

export default function MessagesScreen() {
  const { colors, user } = useApp();
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /** Loads the inbox, then marks it read — the unread dots stay for this visit so new ones are still easy to spot. */
  const load = useCallback(async () => {
    if (!user) return;
    try {
      setMessages(await getMyMessages(user.id));
      setFailed(false);
      await markMessagesRead();
      clearUnreadMessages();
    } catch {
      setFailed(true);
      setMessages(list => list ?? []);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Page>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {messages === null && <ActivityIndicator color={colors.primary} style={styles.loading} />}

        {messages?.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✉️</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{failed ? "Couldn't load messages" : 'No messages yet'}</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              {failed ? 'Check your connection and pull down to try again.' : 'Updates from the kitchen will show up here.'}
            </Text>
          </View>
        )}

        {messages?.map(message => (
          <Card key={message.id} radius={12} padding={16} border={colors.surfaceBorder}>
            <View style={styles.stack6}>
              <View style={styles.titleRow}>
                {!message.isRead && <View style={[styles.dot, { backgroundColor: colors.primary }]} accessibilityLabel="Unread" />}
                <Text style={[styles.title, { color: colors.text }]}>{message.title}</Text>
              </View>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{message.body}</Text>
              <Text style={[styles.meta, { color: colors.mutedText }]}>{fmtSentAt(message.sentAt)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, flexGrow: 1 },
  loading: { marginTop: 40 },
  empty: { alignItems: 'center', gap: 8, marginTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  stack6: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 11 },
});
