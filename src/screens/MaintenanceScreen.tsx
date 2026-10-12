import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { ProGate } from '../components/ProGate';
import { AppBar, Screen, EmptyState, Fab, IconButton, Touchable, useScrollBottom, type Tone } from '../components/ui';
import { Icon } from '../components/Icon';
import { reminderStatus, type Reminder } from '../lib/reminders';
import { cancelNotification } from '../lib/notifications';
import { fmtDate, computeStats } from '../lib/fuel-utils';
import { kmToDisplayDistance, distanceUnitLabel, type UnitSystem } from '../lib/units';
import { radius, space, typography, useBottomInset, useThemedStyles, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Maintenance'>;
type Status = ReturnType<typeof reminderStatus>;

const STATUS_LABEL: Record<Status, string> = {
  overdue: 'Overdue', upcoming: 'Due soon', ok: 'Scheduled', done: 'Done',
};

const STATUS_TONE: Record<Status, Tone> = {
  overdue: 'error', upcoming: 'warning', ok: 'neutral', done: 'success',
};

function toneFor(colors: ThemeColors, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'error': return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    case 'warning': return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
    case 'success': return { bg: colors.successContainer, fg: colors.onSuccessContainer };
    default: return { bg: colors.surfaceContainerHighest, fg: colors.onSurfaceVariant };
  }
}

function ReminderRow({ reminder, currentOdometer, unitSystem, isFirst, isLast, completing, onPress, onComplete, onDelete }: {
  reminder: Reminder;
  completing: boolean;
  currentOdometer: number | null;
  unitSystem: UnitSystem;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const status = reminderStatus(reminder, currentOdometer);
  const tone = toneFor(colors, STATUS_TONE[status]);
  const due = reminder.due_type === 'date' && reminder.due_date
    ? `Due ${fmtDate(reminder.due_date)}`
    : reminder.due_odometer !== null
      ? `Due at ${Math.round(kmToDisplayDistance(reminder.due_odometer, unitSystem)).toLocaleString()} ${distanceUnitLabel(unitSystem)}`
      : '';
  const repeats = reminder.recurrence_interval_days || reminder.recurrence_interval_km ? 'Repeats' : null;
  const meta = [due, repeats].filter(Boolean).join(' · ');

  return (
    <View style={[styles.rowWrap, isFirst && styles.rowFirst, isLast && styles.rowLast]}>
      {!isFirst ? <View style={styles.divider} /> : null}
      <View style={styles.rowLine}>
        <Touchable
          onPress={onPress}
          onLongPress={onDelete}
          accessibilityLabel={`${reminder.title}, ${STATUS_LABEL[status]}, ${meta}`}
          accessibilityHint="Opens the reminder for editing. Long press to delete."
          style={styles.row}
        >
          <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
            <Icon name={reminder.due_type === 'date' ? 'event' : 'speed'} size={20} color={tone.fg} />
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, status === 'done' && styles.rowTitleDone]}>{reminder.title}</Text>
            <Text style={styles.rowMeta}>{meta}</Text>
            <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusText, { color: tone.fg }]}>{STATUS_LABEL[status]}</Text>
            </View>
          </View>
        </Touchable>
        {status !== 'done' ? (
          <View style={styles.rowAction}>
            <IconButton
              icon="check"
              variant="tonal"
              accessibilityLabel={`Mark ${reminder.title} done`}
              disabled={completing}
              onPress={onComplete}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MaintenanceList({ navigation }: Props) {
  const { fills, reminders, unitSystem, completeReminder: markReminderDone, removeReminder } = useGarage();
  const { styles } = useThemedStyles(makeStyles);
  const bottom = useBottomInset();
  const scrollBottom = useScrollBottom(96);
  const [completing, setCompleting] = useState<string | null>(null);

  const stats = computeStats(fills);
  const currentOdometer = stats.length > 0 ? stats[stats.length - 1].fill.odometer : null;

  async function handleComplete(r: Reminder) {
    if (completing) return;
    setCompleting(r.id);
    try {
      await markReminderDone(r.id);
    } finally {
      setCompleting(null);
    }
  }

  function handleDelete(r: Reminder) {
    Alert.alert('Delete this reminder?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await removeReminder(r.id);
          await cancelNotification(r.id);
        },
      },
    ]);
  }

  const sorted = [...reminders].sort((a, b) => {
    const rank = { overdue: 0, upcoming: 1, ok: 2, done: 3 };
    return rank[reminderStatus(a, currentOdometer)] - rank[reminderStatus(b, currentOdometer)];
  });

  return (
    <View style={styles.body}>
      <FlatList
        data={sorted}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottom }]}
        renderItem={({ item, index }) => (
          <ReminderRow
            reminder={item}
            currentOdometer={currentOdometer}
            unitSystem={unitSystem}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
            completing={completing === item.id}
            onPress={() => navigation.navigate('AddReminder', { editId: item.id })}
            onComplete={() => void handleComplete(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={(
          <EmptyState
            icon="notifications"
            title="No reminders yet"
            body="Add one for your next oil change, tyre rotation or insurance renewal."
          />
        )}
      />
      <Fab
        icon="add"
        label="Reminder"
        onPress={() => navigation.navigate('AddReminder')}
        style={[styles.fab, { bottom: bottom + space.lg }]}
      />
    </View>
  );
}

export default function MaintenanceScreen(props: Props) {
  const { navigation } = props;
  return (
    <Screen>
      <AppBar title="Maintenance" onClose={() => navigation.goBack()} />
      <ProGate
        title="Maintenance reminders"
        description="Never miss an oil change, tyre rotation or insurance renewal, by date or by odometer reading."
        onUnlockPress={() => navigation.navigate('Paywall')}
      >
        <MaintenanceList {...props} />
      </ProGate>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { flex: 1 },
    listContent: { paddingHorizontal: space.lg, paddingTop: space.sm, flexGrow: 1 },
    rowWrap: { backgroundColor: colors.surfaceContainer, overflow: 'hidden' },
    rowFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
    rowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginLeft: 72 },
    rowLine: { flexDirection: 'row', alignItems: 'stretch' },
    row: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.lg,
      paddingLeft: space.lg, paddingRight: space.sm, paddingVertical: space.md, minHeight: 88,
    },
    rowAction: { justifyContent: 'center', paddingRight: space.sm },
    rowIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1, flexShrink: 1, gap: 2 },
    rowTitle: { ...typography.bodyLarge, color: colors.onSurface },
    rowTitleDone: { color: colors.onSurfaceVariant, textDecorationLine: 'line-through' },
    rowMeta: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
    statusPill: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 2, marginTop: space.xs },
    statusText: { ...typography.labelMedium },
    fab: { position: 'absolute', right: space.lg },
  });
}
