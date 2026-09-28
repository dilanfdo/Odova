import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { computeStats, todayISODate } from '../lib/fuel-utils';
import {
  distanceUnitLabel, volumeUnitLabel, kmToDisplayDistance, displayDistanceToKm,
  litresToDisplayVolume, displayVolumeToLitres, pricePerLitreToDisplay, displayPriceToPerLitre,
} from '../lib/units';
import { Field, Button, ScreenHeader, ErrorText } from '../components/ui';
import { useThemedStyles, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFill'>;

export default function AddFillScreen({ navigation, route }: Props) {
  const { addFill, updateFill, fills, error, unitSystem } = useGarage();
  const { styles } = useThemedStyles(makeStyles);
  const distU = distanceUnitLabel(unitSystem);
  const volU = volumeUnitLabel(unitSystem);
  const editFill = route.params?.editId ? fills.find((f) => f.id === route.params!.editId) : undefined;
  const [fillDate, setFillDate] = useState(editFill?.fill_date.slice(0, 10) ?? todayISODate());
  const [odometer, setOdometer] = useState(
    editFill ? String(kmToDisplayDistance(editFill.odometer, unitSystem)) : ''
  );
  const [litres, setLitres] = useState(
    editFill ? String(litresToDisplayVolume(editFill.litres, unitSystem)) : ''
  );
  const [price, setPrice] = useState(
    editFill ? String(pricePerLitreToDisplay(editFill.price_per_litre, unitSystem)) : ''
  );
  const [isPartial, setIsPartial] = useState(editFill?.is_partial ?? false);
  const [notes, setNotes] = useState(editFill?.notes ?? '');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!odometer || !litres || !price) {
      setLocalError(`Odometer, ${volU === 'gal' ? 'gallons' : 'litres'}, and price are required`);
      return;
    }
    const odoInput = parseFloat(odometer);
    const litInput = parseFloat(litres);
    const pplInput = parseFloat(price);
    if (!Number.isFinite(odoInput) || !Number.isFinite(litInput) || !Number.isFinite(pplInput)) {
      setLocalError('Odometer, volume, and price must be valid numbers');
      return;
    }
    if (litInput <= 0) {
      setLocalError(`${volU === 'gal' ? 'Gallons' : 'Litres'} must be greater than 0`);
      return;
    }
    if (pplInput <= 0) {
      setLocalError('Price must be greater than 0');
      return;
    }
    if (odoInput < 0) {
      setLocalError('Odometer cannot be negative');
      return;
    }
    const odo = displayDistanceToKm(odoInput, unitSystem);
    const lit = displayVolumeToLitres(litInput, unitSystem);
    const ppl = displayPriceToPerLitre(pplInput, unitSystem);
    if (!editFill) {
      const stats = computeStats(fills);
      const lastOdo = stats.length > 0 ? stats[stats.length - 1].fill.odometer : null;
      if (lastOdo !== null && odo <= lastOdo) {
        setLocalError(`Odometer must be greater than last reading (${fmtInt(kmToDisplayDistance(lastOdo, unitSystem))} ${distU})`);
        return;
      }
    }
    setLocalError('');
    setBusy(true);
    const payload = { fillDate, odometer: odo, litres: lit, pricePerLitre: ppl, isPartial, notes };
    const ok = editFill ? await updateFill(editFill.id, payload) : await addFill(payload);
    setBusy(false);
    if (ok) navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    <ScreenHeader title={editFill ? 'Edit Fill-up' : 'Log a Fill-up'} onClose={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      <Field label="Date (YYYY-MM-DD)" value={fillDate} onChangeText={setFillDate} />
      <Field label={`Odometer (${distU})`} value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" />
      <Field label={volU === 'gal' ? 'Gallons' : 'Litres'} value={litres} onChangeText={setLitres} keyboardType="decimal-pad" />
      <Field label={`Price per ${volU === 'gal' ? 'gallon' : 'litre'}`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Partial fill (excludes from efficiency calc)</Text>
        <Switch value={isPartial} onValueChange={setIsPartial} />
      </View>

      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      <ErrorText>{localError || error}</ErrorText>

      <Button title={editFill ? 'Save Changes' : 'Save Fill-up'} variant="fill" onPress={handleSave} loading={busy} />
    </ScrollView>
    </SafeAreaView>
  );
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingTop: 4 },
    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14, gap: 12,
    },
    switchLabel: { flex: 1, fontSize: 13, color: colors.muted },
  });
}
