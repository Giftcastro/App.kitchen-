/** AdminNotificationsPage.xaml + AdminNotificationsViewModel — "Broadcast Notifications". */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Page, Picker, PlainEntry } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { getCompanies, getUsers } from '../../services/directory';
import { AUDIENCE_OPTIONS, COMPANY_AUDIENCE, getSentHistory, type MessageTarget, PERSON_AUDIENCE, sendNotification } from '../../services/promos';
import { fmtSentAt } from '../../services/scheduling';
import type { NotificationLog } from '../../models';

export default function AdminNotificationsScreen() {
  const { colors } = useApp();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<{ label: string; value: MessageTarget }>({ label: 'All Customers', value: { audience: 'All Customers' } });
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSentHistory()
        .then(setHistory)
        .catch(() => setHistory([]));
    }, [])
  );

  /** A group is picked straight from the list; "A Company…" and "One Person…" ask which one next. */
  const pickAudience = async (choice: string) => {
    try {
      if (choice === COMPANY_AUDIENCE) {
        const companies = (await getCompanies()).filter(c => c.isActive);
        if (companies.length === 0) {
          await alerts.show('No Companies', 'There are no active companies to message.', 'OK');
          return;
        }
        const name = await alerts.choose({ title: 'Which company?', message: 'Everyone signed up under it gets the message.', options: companies.map(c => c.name), cancel: 'Cancel', compact: true });
        const company = companies.find(c => c.name === name);
        if (company) setTarget({ label: `Company: ${company.name}`, value: { audience: 'Company', companyId: company.id } });
      } else if (choice === PERSON_AUDIENCE) {
        const query = await alerts.prompt('One Person', 'Search by name or email.', { acceptText: 'Search' });
        const q = query?.trim().toLowerCase();
        if (!q) return;
        const matches = (await getUsers()).filter(u => u.isActive && (u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))).slice(0, 25);
        if (matches.length === 0) {
          await alerts.show('No Match', `Nobody active matches "${query!.trim()}".`, 'OK');
          return;
        }
        const rowLabel = (u: (typeof matches)[number]) => `${u.fullName || u.email} · ${u.email}`;
        const picked = await alerts.choose({ title: 'Send to', options: matches.map(rowLabel), cancel: 'Cancel', compact: true });
        const person = matches.find(u => rowLabel(u) === picked);
        if (person) setTarget({ label: `Person: ${person.fullName || person.email}`, value: { audience: 'Person', userId: person.id } });
      } else {
        setTarget({ label: choice, value: { audience: choice } as MessageTarget });
      }
    } catch (err) {
      await alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK');
    }
  };

  /**
   * Delivers the message to each recipient's in-app inbox (Profile > Messages),
   * prepends it to Sent History, then clears the form.
   */
  const send = async () => {
    if (!title.trim() || !message.trim()) {
      await alerts.show('Missing Information', 'Please provide both a title and message body.', 'OK');
      return;
    }
    setIsBusy(true);
    try {
      const log = await sendNotification(title.trim(), message.trim(), target.value);
      setHistory(list => [log, ...list]);
      setTitle('');
      setMessage('');
      setIsBusy(false);
      await alerts.show(
        log.recipientCount > 0 ? 'Sent' : 'Nobody to Send To',
        log.recipientCount > 0
          ? `Sent to ${log.targetAudience} (${log.recipientCount} ${log.recipientCount === 1 ? 'person' : 'people'}). They'll see it in Profile › Messages.`
          : `No active accounts matched ${log.targetAudience}. It's saved in Sent History.`,
        'OK'
      );
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
              <Picker title="Select Target Group" options={AUDIENCE_OPTIONS} selected={target.label} onSelect={pickAudience} />
            </View>
            <View style={styles.field}>
              {fieldLabel('Notification Title')}
              <PlainEntry value={title} onChangeText={setTitle} placeholder="e.g., Special Dinner Promo!" bg={colors.pageBg} style={[styles.input, { borderColor: colors.surfaceBorder }]} />
            </View>
            <View style={styles.field}>
              {fieldLabel('Message Body')}
              <PlainEntry
                value={message}
                onChangeText={setMessage}
                placeholder="Write broadcast details here..."
                multiline
                height={90}
                bg={colors.pageBg}
                style={[styles.input, { borderColor: colors.surfaceBorder }]}
              />
            </View>
            <Btn title="Send Message" onPress={send} disabled={isBusy} bg={colors.brandGold} color={colors.onBrandGold} bold radius={8} style={styles.send} />
            {isBusy && <ActivityIndicator color={colors.brandGold} />}
          </View>
        </Card>

        <Text style={[styles.heading, styles.historyHeading, { color: colors.text }]}>Sent History</Text>

        {history.length === 0 && <Text style={[styles.body, { color: colors.mutedText }]}>No broadcasts sent yet.</Text>}
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
  field: { gap: 6 },
  // Visible field boundary — MAUI's bare Entry/Editor read as plain text on a card.
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  send: { marginTop: 8 },
  stack4: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  logTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  audience: { fontSize: 11, fontWeight: '700' },
  body: { fontSize: 13 },
  meta: { fontSize: 10 },
});
