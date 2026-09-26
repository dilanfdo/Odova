import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { addReminder, type DueType } from '../lib/reminders';
import { scheduleDueDateNotification } from '../lib/notifications';
import { Field, Button, ScreenHeader, ErrorText, ChipGroup } from '../components/ui';
import { useThemedStyles, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddReminder'>;

const PRESETS = ['Oil change', 'Tyre rotation', 'Brake inspection', 'Insurance renewal', 'Registration renewal'];
const DUE_TYPE_OPTIONS: { value: DueType; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'odometer', label: 'Odometer' },
];

export default function AddReminderScreen({ navigation }: Props) {
  const { activeVehicleId } = useGarage();
  const { styles } = useThemedStyles(makeStyles);
  const [title, setTitle] = useState('');
  const [dueType, setDueType] = useState<DueType>('date');
  const [dueDate, setDueDate] = useState('');
  const [dueOdometer, setDueOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!activeVehicleId) return;
    if (!title.trim()) { setError('Give the reminder a title'); return; }
    if (dueType === 'date') {
      const trimmed = dueDate.trim();
      if (!trimmed) { setError('Enter a due date'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(new Date(trimmed).getTime())) {
        setError('Enter a valid date in YYYY-MM-DD format');
        return;
      }
    }
    if (dueType === 'odometer') {
      const trimmed = dueOdometer.trim();
      if (!trimmed) { setError('Enter a due odometer reading'); return; }
      if (!Number.isFinite(parseFloat(trimmed))) {
        setError('Enter a valid odometer reading');
        return;
      }
    }
    setError('');
    setBusy(true);
    try {
      const reminder = await addReminder(activeVehicleId, {
        title,
        dueType,
        dueDate: dueType === 'date' ? dueDate : null,
        dueOdometer: dueType === 'odometer' ? parseFloat(dueOdometer) : null,
        notes,
      });
      if (dueType === 'date' && reminder.dueDate) {
        await scheduleDueDateNotification({ reminderId: reminder.id, title: reminder.title, dueDateISO: reminder.dueDate });
      }
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    <ScreenHeader title="New Reminder" onClose={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.presetsWrap}>
        <ChipGroup
          options={PRESETS.map((p) => ({ value: p, label: p }))}
          onChange={setTitle}
        />
      </View>

      <Field label="Title" placeholder="e.g. Oil change" value={title} onChangeText={setTitle} />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Remind by</Text>
        <ChipGroup options={DUE_TYPE_OPTIONS} value={dueType} onChange={setDueType} />
      </View>

      {dueType === 'date' ? (
        <Field label="Due date (YYYY-MM-DD)" placeholder="2026-12-01" value={dueDate} onChangeText={setDueDate} />
      ) : (
        <Field label="Due at odometer (km)" placeholder="45000" value={dueOdometer} onChangeText={setDueOdometer} keyboardType="decimal-pad" />
      )}

      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      <ErrorText>{error}</ErrorText>

      <Button title="Save Reminder" variant="fill" onPress={handleSave} loading={busy} />
    </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingTop: 4 },
    fieldGroup: { marginBottom: 14, gap: 8 },
    label: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
      textTransform: 'uppercase', color: colors.faint,
    },
    presetsWrap: { marginBottom: 14 },
  });
}
