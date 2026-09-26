import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { computeStats } from '../lib/fuel-utils';
import { Field, Button } from '../components/ui';
import { useColors, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFill'>;

export default function AddFillScreen({ navigation }: Props) {
  const { addFill, fills, error } = useGarage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [fillDate, setFillDate] = useState(new Date().toISOString().slice(0, 10));
  const [odometer, setOdometer] = useState('');
  const [litres, setLitres] = useState('');
  const [price, setPrice] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!odometer || !litres || !price) {
      setLocalError('Odometer, litres, and price are required');
      return;
    }
    const odo = parseFloat(odometer);
    const lit = parseFloat(litres);
    const ppl = parseFloat(price);
    if (!Number.isFinite(odo) || !Number.isFinite(lit) || !Number.isFinite(ppl)) {
      setLocalError('Odometer, litres, and price must be valid numbers');
      return;
    }
    if (lit <= 0) {
      setLocalError('Litres must be greater than 0');
      return;
    }
    if (ppl <= 0) {
      setLocalError('Price per litre must be greater than 0');
      return;
    }
    if (odo < 0) {
      setLocalError('Odometer cannot be negative');
      return;
    }
    const stats = computeStats(fills);
    const lastOdo = stats.length > 0 ? stats[stats.length - 1].fill.odometer : null;
    if (lastOdo !== null && odo <= lastOdo) {
      setLocalError(`Odometer must be greater than last reading (${lastOdo.toLocaleString()} km)`);
      return;
    }
    setLocalError('');
    setBusy(true);
    const ok = await addFill({
      fillDate, odometer: odo, litres: lit,
      pricePerLitre: ppl, isPartial, notes,
    });
    setBusy(false);
    if (ok) navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Log a Fill-up</Text>

      <Field label="Date (YYYY-MM-DD)" value={fillDate} onChangeText={setFillDate} />
      <Field label="Odometer (km)" value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" />
      <Field label="Litres" value={litres} onChangeText={setLitres} keyboardType="decimal-pad" />
      <Field label="Price per litre" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Partial fill (excludes from efficiency calc)</Text>
        <Switch value={isPartial} onValueChange={setIsPartial} />
      </View>

      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      {(localError || error) ? <Text style={styles.error}>{localError || error}</Text> : null}

      <Button title="Save Fill-up" variant="fill" onPress={handleSave} loading={busy} />
      <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20 },
    title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 },
    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14, gap: 12,
    },
    switchLabel: { flex: 1, fontSize: 13, color: colors.muted },
    error: { color: colors.red, fontSize: 13, marginBottom: 12 },
    cancel: { color: colors.faint, fontSize: 13, fontWeight: '600' },
  });
}
