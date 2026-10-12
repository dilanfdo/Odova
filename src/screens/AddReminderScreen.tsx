import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { type DueType } from '../lib/reminders';
import { scheduleDueDateNotification } from '../lib/notifications';
import { distanceUnitLabel, displayDistanceToKm, kmToDisplayDistance } from '../lib/units';
import { todayISODate } from '../lib/fuel-utils';
import {
  TextField, DateField, Button, AppBar, ErrorText, ChipGroup, SegmentedButtons, Screen, FormLayout,
  ListGroup, SwitchItem, SectionHeader,
} from '../components/ui';
import { space, useThemedStyles } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddReminder'>;
type FieldErrors = Partial<Record<'title' | 'dueDate' | 'dueOdometer' | 'interval', string>>;

const PRESETS = ['Oil change', 'Tyre rotation', 'Brake inspection', 'Insurance renewal', 'Registration renewal'];
const DUE_TYPE_OPTIONS: { value: DueType; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'odometer', label: 'Odometer' },
];

export default function AddReminderScreen({ navigation, route }: Props) {
  const { reminders, addReminder, updateReminder, unitSystem, error: garageError } = useGarage();
  const { styles } = useThemedStyles(makeStyles);
  const distU = distanceUnitLabel(unitSystem);
  const editReminder = route.params?.editId ? reminders.find((r) => r.id === route.params!.editId) : undefined;

  const [title, setTitle] = useState(editReminder?.title ?? '');
  const [dueType, setDueType] = useState<DueType>(editReminder?.due_type ?? 'date');
  const [dueDate, setDueDate] = useState<string | null>(editReminder?.due_date ?? null);
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  function clearError(key: keyof FieldErrors) {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSave() {
    const next: FieldErrors = {};
    if (!title.trim()) next.title = 'Give the reminder a title';
    if (dueType === 'date' && !dueDate) next.dueDate = 'Pick a due date';
    let dueOdometerKm: number | null = null;
    if (dueType === 'odometer') {
      const parsed = parseFloat(dueOdometer.trim());
      if (!dueOdometer.trim()) next.dueOdometer = 'Enter a due odometer reading';
      else if (!Number.isFinite(parsed)) next.dueOdometer = 'Enter a valid number';
      else dueOdometerKm = displayDistanceToKm(parsed, unitSystem);
    }
    let intervalValue: number | null = null;
    if (repeats) {
      intervalValue = parseFloat(repeatInterval);
      if (!Number.isFinite(intervalValue) || intervalValue <= 0) {
        next.interval = dueType === 'date' ? 'Enter how many days between repeats' : `Enter how many ${distU} between repeats`;
      }
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    try {
      const payload = {
        title,
        dueType,
        dueDate: dueType === 'date' ? dueDate : null,
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
    <Screen>
      <AppBar title={editReminder ? 'Edit reminder' : 'New reminder'} onClose={() => navigation.goBack()} />
      <FormLayout
        footer={(
          <Button
            title={editReminder ? 'Save changes' : 'Save reminder'}
            icon="check"
            onPress={handleSave}
            loading={busy}
          />
        )}
      >
        <TextField
          label="Title"
          placeholder="e.g. Oil change"
          value={title}
          onChangeText={(t) => { setTitle(t); clearError('title'); }}
          error={errors.title}
        />
        <View style={styles.presets}>
          <ChipGroup
            options={PRESETS.map((p) => ({ value: p, label: p }))}
            onChange={(p) => { setTitle(p); clearError('title'); }}
            accessibilityLabel="Suggested titles"
          />
        </View>

        <SectionHeader title="Remind me by" />
        <View style={styles.block}>
          <SegmentedButtons options={DUE_TYPE_OPTIONS} value={dueType} onChange={setDueType} accessibilityLabel="Remind by" />
        </View>

        {dueType === 'date' ? (
          <DateField
            label="Due date"
            value={dueDate}
            onChange={(d) => { setDueDate(d); clearError('dueDate'); }}
            minimumDate={editReminder ? undefined : new Date(`${todayISODate()}T00:00:00`)}
            error={errors.dueDate}
          />
        ) : (
          <TextField
            label="Due at odometer"
            placeholder="45000"
            value={dueOdometer}
            onChangeText={(t) => { setDueOdometer(t); clearError('dueOdometer'); }}
            keyboardType="decimal-pad"
            suffix={distU}
            error={errors.dueOdometer}
          />
        )}

        <ListGroup style={styles.block}>
          <SwitchItem
            headline="Repeats"
            supporting="Schedule the next one when you mark this done"
            value={repeats}
            onValueChange={setRepeats}
          />
        </ListGroup>

        {repeats ? (
          <TextField
            label="Repeat every"
            placeholder={dueType === 'date' ? '180' : '10000'}
            value={repeatInterval}
            onChangeText={(t) => { setRepeatInterval(t); clearError('interval'); }}
            keyboardType="number-pad"
            suffix={dueType === 'date' ? 'days' : distU}
            error={errors.interval}
          />
        ) : null}

        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

        <ErrorText>{garageError}</ErrorText>
      </FormLayout>
    </Screen>
  );
}

function makeStyles() {
  return StyleSheet.create({
    presets: { marginTop: -space.sm, marginBottom: space.sm },
    block: { marginBottom: space.lg },
  });
}
