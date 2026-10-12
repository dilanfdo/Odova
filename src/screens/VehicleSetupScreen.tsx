import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGarage } from '../context/GarageContext';
import {
  TextField, Button, AppBar, ErrorText, ChipGroup, Screen, FormLayout, SectionHeader,
} from '../components/ui';
import { space, typography, useThemedStyles, type ThemeColors } from '../theme';
import { FUEL_TYPES } from '../lib/types';
import type { Vehicle } from '../lib/types';

type FieldErrors = Partial<Record<'make' | 'model' | 'year', string>>;

export default function VehicleSetupScreen({ editVehicle, onSaved, onClose }: {
  editVehicle?: Vehicle; onSaved?: () => void; onClose?: () => void;
} = {}) {
  const { addVehicle, updateVehicle, error, clearError: clearGarageError, vehicles } = useGarage();
  useEffect(() => { clearGarageError(); }, [clearGarageError]);
  const { styles } = useThemedStyles(makeStyles);
  const [make, setMake] = useState(editVehicle?.make ?? '');
  const [model, setModel] = useState(editVehicle?.model ?? '');
  const [year, setYear] = useState(editVehicle?.year ? String(editVehicle.year) : '');
  const [fuelType, setFuelType] = useState(editVehicle?.fuel_type ?? 'Petrol');
  const [nickname, setNickname] = useState(editVehicle?.nickname ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const title = editVehicle ? 'Edit vehicle' : vehicles.length === 0 ? 'Add your first vehicle' : 'Add a vehicle';
  const maxYear = new Date().getFullYear() + 1;

  function clearError(key: keyof FieldErrors) {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSave() {
    const next: FieldErrors = {};
    if (!make.trim()) next.make = 'Enter the make';
    if (!model.trim()) next.model = 'Enter the model';
    if (year.trim()) {
      const y = Number(year);
      if (!Number.isInteger(y) || y < 1900 || y > maxYear) next.year = `Enter a year between 1900 and ${maxYear}`;
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    const ok = editVehicle
      ? await updateVehicle(editVehicle.id, { make, model, year, fuelType, nickname })
      : await addVehicle({ make, model, year, fuelType, nickname });
    setBusy(false);
    if (ok) onSaved?.();
  }

  return (
    <Screen>
      {onClose ? <AppBar onClose={onClose} /> : null}
      <FormLayout
        contentStyle={!onClose && styles.topSpace}
        footer={(
          <Button
            title={editVehicle ? 'Save changes' : 'Save vehicle'}
            icon="check"
            onPress={handleSave}
            loading={busy}
          />
        )}
      >
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.subtitle}>Make and model are required. Everything else is optional.</Text>

        <TextField
          label="Make"
          placeholder="Toyota"
          value={make}
          onChangeText={(t) => { setMake(t); clearError('make'); }}
          autoCapitalize="words"
          error={errors.make}
        />
        <TextField
          label="Model"
          placeholder="Prius"
          value={model}
          onChangeText={(t) => { setModel(t); clearError('model'); }}
          autoCapitalize="words"
          error={errors.model}
        />
        <View style={styles.row}>
          <View style={styles.yearField}>
            <TextField
              label="Year"
              placeholder="2021"
              value={year}
              onChangeText={(t) => { setYear(t.replace(/[^0-9]/g, '')); clearError('year'); }}
              keyboardType="number-pad"
              maxLength={4}
              error={errors.year}
            />
          </View>
          <View style={styles.nicknameField}>
            <TextField
              label="Nickname"
              placeholder="Daily driver"
              value={nickname}
              onChangeText={setNickname}
              supportingText="Optional"
            />
          </View>
        </View>

        <SectionHeader title="Fuel type" />
        <ChipGroup
          options={FUEL_TYPES.map((t) => ({ value: t, label: t }))}
          value={fuelType}
          onChange={setFuelType}
          accessibilityLabel="Fuel type"
        />

        <View style={styles.errorSpace}>
          <ErrorText>{error}</ErrorText>
        </View>
      </FormLayout>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    topSpace: { paddingTop: space.xl },
    title: { ...typography.headlineMedium, color: colors.onSurface },
    subtitle: { ...typography.bodyMedium, color: colors.onSurfaceVariant, marginTop: space.xs, marginBottom: space.xl },
    row: { flexDirection: 'row', gap: space.md },
    yearField: { flex: 2 },
    nicknameField: { flex: 3 },
    errorSpace: { marginTop: space.xl },
  });
}
