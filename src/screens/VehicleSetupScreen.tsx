import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGarage } from '../context/GarageContext';
import { Field, Button } from '../components/ui';
import { useColors, type ThemeColors } from '../theme';
import { FUEL_TYPES } from '../lib/types';

export default function VehicleSetupScreen({ onSaved }: { onSaved?: () => void } = {}) {
  const { addVehicle, error, vehicles } = useGarage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [fuelType, setFuelType] = useState('Petrol');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleSave() {
    if (!make.trim() || !model.trim()) {
      setLocalError('Make and model are required');
      return;
    }
    setLocalError('');
    setBusy(true);
    const ok = await addVehicle({ make, model, year, fuelType, nickname });
    setBusy(false);
    if (ok) onSaved?.();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {vehicles.length === 0 ? 'Add your first vehicle' : 'Add a vehicle'}
      </Text>
      <Text style={styles.subtitle}>Make and model are required — the rest is optional.</Text>

      <Field label="Make" placeholder="Toyota" value={make} onChangeText={setMake} />
      <Field label="Model" placeholder="Prius" value={model} onChangeText={setModel} />
      <Field label="Year" placeholder="2021" value={year} onChangeText={setYear} keyboardType="number-pad" />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Fuel type</Text>
        <View style={styles.chipRow}>
          {FUEL_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setFuelType(t)}
              style={[styles.chip, fuelType === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, fuelType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Field label="Nickname (optional)" placeholder="Daily driver" value={nickname} onChangeText={setNickname} />

      {(localError || error) ? <Text style={styles.error}>{localError || error}</Text> : null}

      <Button title="Save Vehicle" variant="fill" onPress={handleSave} loading={busy} style={{ marginTop: 8 }} />
    </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20 },
    title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
    subtitle: { fontSize: 13, color: colors.muted, marginBottom: 20 },
    fieldGroup: { marginBottom: 14, gap: 8 },
    label: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
      textTransform: 'uppercase', color: colors.faint,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingVertical: 8, paddingHorizontal: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { borderColor: colors.accent, backgroundColor: 'rgba(59,130,246,0.1)' },
    chipText: { fontSize: 13, color: colors.muted },
    chipTextActive: { color: colors.text, fontWeight: '700' },
    error: { color: colors.red, fontSize: 13, marginBottom: 12 },
  });
}
