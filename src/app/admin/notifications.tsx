/** AdminNotificationsPage.xaml + AdminNotificationsViewModel — "Broadcast Notifications". */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Page, Picker, PlainEntry } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { getUsers } from '../../services/directory';
import { AUDIENCE_OPTIONS, getRecipientCount, getSentHistory, sendNotification } from '../../services/promos';
import { fmtSentAt } from '../../services/scheduling';
import type { NotificationLog } from '../../models';

export default function AdminNotificationsScreen() {
  const { colors } = useApp();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('All Customers');
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSentHistory()
        .then(setHistory)
        .catch(() => setHistory([]));
    }, [])
  );

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      await alerts.show('Missing Information', 'Please provide both a title and message body.', 'OK');
      return;
    }
    setIsBusy(true);
    try {
      const users = await getUsers();
      const recipientCount = await getRecipientCount(audience, users);
      const log = await sendNotification(title.trim(), message.trim(), audience, recipientCount);
      setHistory(list => [log, ...list]);
      setTitle('');
      setMessage('');
      setIsBusy(false);
      await alerts.show('Success', `Notification broadcasted to ${log.targetAudience} (${log.recipientCount} recipients).`, 'OK');
    } catch (err) {
      setIsBusy(false);
      await alerts.show('Not Sent', (err as Error)?.message ?? 'Could not send this broadcast.', 'OK');
    }
  };

  const fieldLabel = (text: string) => <Text style={[styles.fieldLabel, { color: colors.brandGold }]}>{text}</Text>;

  return (
    <Page>
      <AdminNavStrip activeRoute="adminnotifications" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card radius={12}>
          <View style={styles.form}>
            <Text style={[styles.heading, { color: colors.text }]}>Compose Broadcast</Text>
            <View style={styles.field}>
              {fieldLabel('Target Audience')}
              <Picker title="Select Target Group" options={AUDIENCE_OPTIONS} selected={audience} onSelect={setAudience} />
            </View>
            <View style={styles.field}>
              {fieldLabel('Notification Title')}
              <PlainEntry value={title} onChangeText={setTitle} placeholder="e.g., Special Dinner Promo!" />
            </View>
            <View style={styles.field}>
              {fieldLabel('Message Body')}
              <PlainEntry value={message} onChangeText={setMessage} placeholder="Write broadcast details here..." multiline height={90} />
            </View>
            <Btn title="Send Push Broadcast" onPress={send} disabled={isBusy} bg={colors.brandGold} color={colors.onBrandGold} bold radius={8} style={styles.send} />
            {isBusy && <ActivityIndicator color={colors.brandGold} />}
          </View>
        </Card>

        <Text style={[styles.heading, styles.historyHeading, { color: colors.text }]}>Sent History</Text>

        {history.map(log => (
          <Card key={log.id} radius={10} padding={14}>
            <View style={styles.stack4}>
              <View style={styles.row}>
                <Text style={[styles.logTitle, { color: colors.text }]}>{log.title}</Text>
                <Text style={[styles.audience, { color: colors.brandGold }]}>{log.targetAudience}</Text>
              </View>
              <Text style={[styles.body, { color: colors.mutedText }]}>{log.body}</Text>
              <View style={styles.row}>
                <Text style={[styles.meta, { color: colors.mutedText }]}>{fmtSentAt(log.sentAt)}</Text>
                <Text style={[styles.meta, { color: colors.mutedText }]}>{log.recipientCount} recipients</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 20 },
  form: { gap: 14 },
  heading: { fontSize: 18, fontWeight: '700' },
  historyHeading: { marginTop: 10 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  send: { marginTop: 8 },
  stack4: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  logTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  audience: { fontSize: 11, fontWeight: '700' },
  body: { fontSize: 13 },
  meta: { fontSize: 10 },
});
