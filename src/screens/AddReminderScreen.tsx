import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { type DueType } from '../lib/reminders';
import { scheduleDueDateNotification } from '../lib/notifications';
import { distanceUnitLabel, displayDistanceToKm, kmToDisplayDistance } from '../lib/units';
import { Field, Button, ScreenHeader, ErrorText, ChipGroup } from '../components/ui';
import { useThemedStyles, useThemeMode, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddReminder'>;

const PRESETS = ['Oil change', 'Tyre rotation', 'Brake inspection', 'Insurance renewal', 'Registration renewal'];
const DUE_TYPE_OPTIONS: { value: DueType; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'odometer', label: 'Odometer' },
];

// Deliberately NOT `d.toISOString().slice(0, 10)` — that converts to UTC
// first, which shifts the date backward by one day for anyone in a
// positive UTC offset (e.g. Sri Lanka, UTC+5:30) picking a date near
// midnight local time. Use local date components instead.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  // new Date('YYYY-MM-DD') parses as UTC midnight, which can render as the
  // previous day in a negative-UTC-offset timezone — construct in local time.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function AddReminderScreen({ navigation, route }: Props) {
  const { reminders, addReminder, updateReminder, unitSystem } = useGarage();
  const { styles } = useThemedStyles(makeStyles);
  const { resolvedScheme } = useThemeMode();
  const distU = distanceUnitLabel(unitSystem);
  const editReminder = route.params?.editId ? reminders.find((r) => r.id === route.params!.editId) : undefined;

  const [title, setTitle] = useState(editReminder?.title ?? '');
  const [dueType, setDueType] = useState<DueType>(editReminder?.due_type ?? 'date');
  const [dueDateObj, setDueDateObj] = useState<Date | null>(
    editReminder?.due_date ? parseISODate(editReminder.due_date) : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueOdometer, setDueOdometer] = useState(
    editReminder?.due_odometer !== null && editReminder?.due_odometer !== undefined
      ? String(kmToDisplayDistance(editReminder.due_odometer, unitSystem))
      : ''
  );
  const [notes, setNotes] = useState(editReminder?.notes ?? '');
  const [repeats, setRepeats] = useState(
    Boolean(editReminder?.recurrence_interval_days || editReminder?.recurrence_interval_km)
  );
  const [repeatInterval, setRepeatInterval] = useState(
    editReminder?.recurrence_interval_days
      ? String(editReminder.recurrence_interval_days)
      : editReminder?.recurrence_interval_km
        ? String(kmToDisplayDistance(editReminder.recurrence_interval_km, unitSystem))
        : ''
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleDateChange(_event: unknown, selectedDate?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setDueDateObj(selectedDate);
  }

  async function handleSave() {
    if (!title.trim()) { setError('Give the reminder a title'); return; }
    if (dueType === 'date' && !dueDateObj) { setError('Pick a due date'); return; }
    let dueOdometerKm: number | null = null;
    if (dueType === 'odometer') {
      const trimmed = dueOdometer.trim();
      if (!trimmed) { setError('Enter a due odometer reading'); return; }
      const parsed = parseFloat(trimmed);
      if (!Number.isFinite(parsed)) { setError('Enter a valid odometer reading'); return; }
      dueOdometerKm = displayDistanceToKm(parsed, unitSystem);
    }
    let intervalValue: number | null = null;
    if (repeats) {
      intervalValue = parseFloat(repeatInterval);
      if (!Number.isFinite(intervalValue) || intervalValue <= 0) {
        setError(dueType === 'date' ? 'Enter how many days it repeats every' : `Enter how many ${distU} it repeats every`);
        return;
      }
    }
    setError('');
    setBusy(true);
    try {
      const payload = {
        title,
        dueType,
        dueDate: dueType === 'date' && dueDateObj ? toISODate(dueDateObj) : null,
        dueOdometer: dueType === 'odometer' ? dueOdometerKm : null,
        notes,
        recurrenceIntervalDays: repeats && dueType === 'date' ? intervalValue : null,
        recurrenceIntervalKm: repeats && dueType === 'odometer' ? displayDistanceToKm(intervalValue!, unitSystem) : null,
      };
      if (editReminder) {
        const ok = await updateReminder(editReminder.id, payload);
        if (!ok) return;
      } else {
        const reminder = await addReminder(payload);
        if (!reminder) return;
        if (dueType === 'date' && reminder.due_date) {
          await scheduleDueDateNotification({ reminderId: reminder.id, title: reminder.title, dueDateISO: reminder.due_date });
        }
      }
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    <ScreenHeader title={editReminder ? 'Edit Reminder' : 'New Reminder'} onClose={() => navigation.goBack()} />
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
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Due date</Text>
          <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
            <Text style={dueDateObj ? styles.dateInputText : styles.dateInputPlaceholder}>
              {dueDateObj ? toISODate(dueDateObj) : 'Select a date'}
            </Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={dueDateObj ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={editReminder ? undefined : new Date()}
              onChange={handleDateChange}
              themeVariant={Platform.OS === 'ios' ? resolvedScheme : undefined}
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <Button title="Done" onPress={() => setShowDatePicker(false)} style={{ marginTop: 8 }} />
          )}
        </View>
      ) : (
        <Field label={`Due at odometer (${distU})`} placeholder="45000" value={dueOdometer} onChangeText={setDueOdometer} keyboardType="decimal-pad" />
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Repeats</Text>
        <Switch value={repeats} onValueChange={setRepeats} />
      </View>

      {repeats && (
        <Field
          label={dueType === 'date' ? 'Repeat every (days)' : `Repeat every (${distU})`}
          placeholder={dueType === 'date' ? '180' : '10000'}
          value={repeatInterval}
          onChangeText={setRepeatInterval}
          keyboardType="decimal-pad"
        />
      )}

      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      <ErrorText>{error}</ErrorText>

      <Button title={editReminder ? 'Save Changes' : 'Save Reminder'} variant="fill" onPress={handleSave} loading={busy} />
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
    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14, gap: 12,
    },
    switchLabel: { fontSize: 13, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    dateInput: {
      backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
      paddingVertical: 10, paddingHorizontal: 12,
    },
    dateInputText: { color: colors.text, fontSize: 15 },
    dateInputPlaceholder: { color: colors.faint, fontSize: 15 },
  });
}
