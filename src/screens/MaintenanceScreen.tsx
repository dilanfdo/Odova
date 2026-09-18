import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { ProGate } from '../components/ProGate';
import { getReminders, deleteReminder, completeReminder, reminderStatus, type Reminder } from '../lib/reminders';
import { cancelNotification } from '../lib/notifications';
import { fmtDate, computeStats } from '../lib/fuel-utils';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Maintenance'>;

const STATUS_LABEL: Record<string, string> = {
  overdue: 'Overdue', upcoming: 'Due soon', ok: 'Scheduled', done: 'Done',
};
const STATUS_COLOR: Record<string, string> = {
  overdue: colors.red, upcoming: colors.amber, ok: colors.muted, done: colors.green,
};

function ReminderRow({ reminder, currentOdometer, onComplete, onDelete }: {
  reminder: Reminder;
  currentOdometer: number | null;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const status = reminderStatus(reminder, currentOdometer);
  return (
    <Pressable onLongPress={onDelete} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{reminder.title}</Text>
        <Text style={styles.rowMeta}>
          {reminder.dueType === 'date' && reminder.dueDate
            ? `Due ${fmtDate(reminder.dueDate)}`
            : `Due at ${reminder.dueOdometer?.toLocaleString()} km`}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={[styles.statusBadge, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
        {status !== 'done' && (
          <Pressable onPress={onComplete}>
            <Text style={styles.completeLink}>Mark done</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function MaintenanceList({ navigation }: Props) {
  const { activeVehicleId, fills } = useGarage();
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const load = useCallback(() => {
    if (!activeVehicleId) return;
    getReminders(activeVehicleId).then(setReminders);
  }, [activeVehicleId]);

  useFocusEffect(load);

  const stats = computeStats(fills);
  const currentOdometer = stats.length > 0 ? stats[stats.length - 1].fill.odometer : null;

  async function handleComplete(r: Reminder) {
    if (!activeVehicleId) return;
    await completeReminder(activeVehicleId, r.id);
    load();
  }

  async function handleDelete(r: Reminder) {
    if (!activeVehicleId) return;
    Alert.alert('Delete this reminder?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteReminder(activeVehicleId, r.id);
          await cancelNotification(r.id);
          load();
        },
      },
    ]);
  }

  const sorted = [...reminders].sort((a, b) => {
    const rank = { overdue: 0, upcoming: 1, ok: 2, done: 3 };
    return rank[reminderStatus(a, currentOdometer)] - rank[reminderStatus(b, currentOdometer)];
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Maintenance</Text>
        <Pressable onPress={() => navigation.navigate('AddReminder')} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Reminder</Text>
        </Pressable>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <ReminderRow
            reminder={item}
            currentOdometer={currentOdometer}
            onComplete={() => handleComplete(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No reminders yet.</Text>
            <Text style={styles.emptyHint}>Add one for your next oil change, tyre rotation, or insurance renewal.</Text>
          </View>
        }
      />
      <Pressable onPress={() => navigation.goBack()} style={{ padding: 16, alignItems: 'center' }}>
        <Text style={styles.close}>Close</Text>
      </Pressable>
    </SafeAreaView>
  );
}

export default function MaintenanceScreen(props: Props) {
  return (
    <ProGate
      title="Maintenance Reminders"
      description="Never miss an oil change, tyre rotation, or insurance renewal — by date or by odometer reading."
      onUnlockPress={() => props.navigation.navigate('Paywall')}
    >
      <MaintenanceList {...props} />
    </ProGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  addBtn: { borderWidth: 1, borderColor: colors.accent, paddingVertical: 6, paddingHorizontal: 10 },
  addBtnText: { fontSize: 11, fontWeight: '700', color: colors.accent, textTransform: 'uppercase' },
  listContent: { padding: 16, flexGrow: 1 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.faint, marginTop: 2 },
  statusBadge: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  completeLink: { fontSize: 11, color: colors.accent, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  emptyHint: { color: colors.faint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  close: { color: colors.faint, fontSize: 13, fontWeight: '600' },
});
