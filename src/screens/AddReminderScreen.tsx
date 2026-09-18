import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { addReminder, type DueType } from '../lib/reminders';
import { scheduleDueDateNotification } from '../lib/notifications';
import { Field, Button } from '../components/ui';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddReminder'>;

const PRESETS = ['Oil change', 'Tyre rotation', 'Brake inspection', 'Insurance renewal', 'Registration renewal'];

export default function AddReminderScreen({ navigation }: Props) {
  const { activeVehicleId } = useGarage();
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
    if (dueType === 'date' && !dueDate.trim()) { setError('Enter a due date'); return; }
    if (dueType === 'odometer' && !dueOdometer.trim()) { setError('Enter a due odometer reading'); return; }
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
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Reminder</Text>

      <View style={styles.chipRow}>
        {PRESETS.map((p) => (
          <Pressable key={p} onPress={() => setTitle(p)} style={styles.chip}>
            <Text style={styles.chipText}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="Title" placeholder="e.g. Oil change" value={title} onChangeText={setTitle} />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Remind by</Text>
        <View style={styles.chipRow}>
          {(['date', 'odometer'] as DueType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setDueType(t)}
              style={[styles.typeChip, dueType === t && styles.typeChipActive]}
            >
              <Text style={[styles.chipText, dueType === t && styles.typeChipTextActive]}>
                {t === 'date' ? 'Date' : 'Odometer'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {dueType === 'date' ? (
        <Field label="Due date (YYYY-MM-DD)" placeholder="2026-12-01" value={dueDate} onChangeText={setDueDate} />
      ) : (
        <Field label="Due at odometer (km)" placeholder="45000" value={dueOdometer} onChangeText={setDueOdometer} keyboardType="decimal-pad" />
      )}

      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Save Reminder" variant="fill" onPress={handleSave} loading={busy} />
      <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  fieldGroup: { marginBottom: 14, gap: 8 },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.faint,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 12, color: colors.muted },
  typeChip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(59,130,246,0.1)' },
  typeChipTextActive: { color: colors.text, fontWeight: '700' },
  error: { color: colors.red, fontSize: 13, marginBottom: 12 },
  cancel: { fontSize: 13, color: colors.faint },
});
