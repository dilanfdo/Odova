import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGarage } from '../context/GarageContext';
import { Field, Button, ScreenHeader, ErrorText, ChipGroup } from '../components/ui';
import { useThemedStyles, type ThemeColors } from '../theme';
import { FUEL_TYPES } from '../lib/types';
import type { Vehicle } from '../lib/types';

export default function VehicleSetupScreen({ editVehicle, onSaved, onClose }: {
  editVehicle?: Vehicle; onSaved?: () => void; onClose?: () => void;
} = {}) {
  const { addVehicle, updateVehicle, error, vehicles } = useGarage();
  const { styles } = useThemedStyles(makeStyles);
  const [make, setMake] = useState(editVehicle?.make ?? '');
  const [model, setModel] = useState(editVehicle?.model ?? '');
  const [year, setYear] = useState(editVehicle?.year ? String(editVehicle.year) : '');
  const [fuelType, setFuelType] = useState(editVehicle?.fuel_type ?? 'Petrol');
  const [nickname, setNickname] = useState(editVehicle?.nickname ?? '');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleSave() {
    if (!make.trim() || !model.trim()) {
      setLocalError('Make and model are required');
      return;
    }
    setLocalError('');
    setBusy(true);
    const ok = editVehicle
      ? await updateVehicle(editVehicle.id, { make, model, year, fuelType, nickname })
      : await addVehicle({ make, model, year, fuelType, nickname });
    setBusy(false);
    if (ok) onSaved?.();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    {onClose && <ScreenHeader onClose={onClose} />}
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {editVehicle ? 'Edit vehicle' : vehicles.length === 0 ? 'Add your first vehicle' : 'Add a vehicle'}
      </Text>
      <Text style={styles.subtitle}>Make and model are required — the rest is optional.</Text>

      <Field label="Make" placeholder="Toyota" value={make} onChangeText={setMake} />
      <Field label="Model" placeholder="Prius" value={model} onChangeText={setModel} />
      <Field label="Year" placeholder="2021" value={year} onChangeText={setYear} keyboardType="number-pad" />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Fuel type</Text>
        <ChipGroup
          options={FUEL_TYPES.map((t) => ({ value: t, label: t }))}
          value={fuelType}
          onChange={setFuelType}
        />
      </View>

      <Field label="Nickname (optional)" placeholder="Daily driver" value={nickname} onChangeText={setNickname} />

      <ErrorText>{localError || error}</ErrorText>

      <Button title={editVehicle ? 'Save Changes' : 'Save Vehicle'} variant="fill" onPress={handleSave} loading={busy} style={{ marginTop: 8 }} />
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
  });
}
