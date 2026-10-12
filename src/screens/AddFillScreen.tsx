import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { fmt, fmtDate, odometerBounds, todayISODate } from '../lib/fuel-utils';
import { currencyByCode } from '../lib/currencies';
import {
  distanceUnitLabel, volumeUnitLabel, kmToDisplayDistance, displayDistanceToKm,
  litresToDisplayVolume, displayVolumeToLitres, pricePerLitreToDisplay, displayPriceToPerLitre,
} from '../lib/units';
import {
  TextField, DateField, Button, AppBar, ErrorText, Screen, FormLayout, ListGroup, SwitchItem,
} from '../components/ui';
import { radius, space, typography, useThemedStyles, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFill'>;
type FieldErrors = Partial<Record<'odometer' | 'litres' | 'price', string>>;

function parsePositive(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function AddFillScreen({ navigation, route }: Props) {
  const { addFill, updateFill, fills, error, clearError: clearGarageError, unitSystem, currencyCode } = useGarage();
  useEffect(() => { clearGarageError(); }, [clearGarageError]);
  const { styles } = useThemedStyles(makeStyles);
  const distU = distanceUnitLabel(unitSystem);
  const volU = volumeUnitLabel(unitSystem);
  const volWord = volU === 'gal' ? 'gallons' : 'litres';
  const currency = currencyByCode(currencyCode);
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const bounds = odometerBounds(fills, fillDate, editFill?.id);
  const fmtOdo = (km: number) => `${fmtInt(kmToDisplayDistance(km, unitSystem))} ${distU}`;
  const odoHint = bounds.before && bounds.after
    ? `Between ${fmtOdo(bounds.before.odometer)} and ${fmtOdo(bounds.after.odometer)}`
    : bounds.before
      ? `Last reading ${fmtOdo(bounds.before.odometer)}`
      : bounds.after
        ? `Less than ${fmtOdo(bounds.after.odometer)}`
        : undefined;
  const litNum = parsePositive(litres);
  const priceNum = parsePositive(price);
  const total = litNum && priceNum && litNum > 0 && priceNum > 0 ? litNum * priceNum : null;

  function clearError(key: keyof FieldErrors) {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const odoInput = parsePositive(odometer);
    if (!odometer.trim()) next.odometer = 'Enter the odometer reading';
    else if (odoInput === null) next.odometer = 'Enter a valid number';
    else if (odoInput < 0) next.odometer = 'Odometer cannot be negative';
    else if (bounds.before && displayDistanceToKm(odoInput, unitSystem) <= bounds.before.odometer) {
      next.odometer = `Must be more than ${fmtOdo(bounds.before.odometer)} (fill-up on ${fmtDate(bounds.before.date)})`;
    } else if (bounds.after && displayDistanceToKm(odoInput, unitSystem) >= bounds.after.odometer) {
      next.odometer = `Must be less than ${fmtOdo(bounds.after.odometer)} (fill-up on ${fmtDate(bounds.after.date)})`;
    }
    if (!litres.trim()) next.litres = `Enter ${volWord}`;
    else if (litNum === null) next.litres = 'Enter a valid number';
    else if (litNum <= 0) next.litres = 'Must be greater than 0';
    if (!price.trim()) next.price = 'Enter the price';
    else if (priceNum === null) next.price = 'Enter a valid number';
    else if (priceNum <= 0) next.price = 'Must be greater than 0';
    return next;
  }

  async function handleSave() {
    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const odo = displayDistanceToKm(parsePositive(odometer)!, unitSystem);
    const lit = displayVolumeToLitres(litNum!, unitSystem);
    const ppl = displayPriceToPerLitre(priceNum!, unitSystem);
    setBusy(true);
    const payload = { fillDate, odometer: odo, litres: lit, pricePerLitre: ppl, isPartial, notes };
    const ok = editFill ? await updateFill(editFill.id, payload) : await addFill(payload);
    setBusy(false);
    if (ok) navigation.goBack();
  }

  return (
    <Screen>
      <AppBar title={editFill ? 'Edit fill-up' : 'Log fill-up'} onClose={() => navigation.goBack()} />
      <FormLayout
        footer={(
          <Button
            title={editFill ? 'Save changes' : 'Save fill-up'}
            icon="check"
            onPress={handleSave}
            loading={busy}
          />
        )}
      >
        <DateField label="Date" value={fillDate} onChange={setFillDate} maximumDate={new Date()} />
        <TextField
          label="Odometer"
          value={odometer}
          onChangeText={(t) => { setOdometer(t); clearError('odometer'); }}
          keyboardType="decimal-pad"
          suffix={distU}
          error={errors.odometer}
          supportingText={odoHint}
        />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField
              label={volU === 'gal' ? 'Gallons' : 'Litres'}
              value={litres}
              onChangeText={(t) => { setLitres(t); clearError('litres'); }}
              keyboardType="decimal-pad"
              suffix={volU}
              error={errors.litres}
            />
          </View>
          <View style={styles.rowItem}>
            <TextField
              label={`Price / ${volU}`}
              value={price}
              onChangeText={(t) => { setPrice(t); clearError('price'); }}
              keyboardType="decimal-pad"
              suffix={currency.symbol}
              error={errors.price}
            />
          </View>
        </View>

        <View style={styles.total} accessible accessibilityLabel={`Total cost ${total ? `${currency.symbol}${fmt(total)}` : 'not calculated yet'}`}>
          <Text style={styles.totalLabel}>Total cost</Text>
          <Text style={styles.totalValue}>{total ? `${currency.symbol}${fmt(total)}` : '—'}</Text>
        </View>

        <ListGroup style={styles.switchGroup}>
          <SwitchItem
            headline="Partial fill"
            supporting="Excluded from efficiency calculations"
            value={isPartial}
            onValueChange={setIsPartial}
          />
        </ListGroup>

        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

        <ErrorText>{error}</ErrorText>
      </FormLayout>
    </Screen>
  );
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString();
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: space.md },
    rowItem: { flex: 1 },
    total: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.secondaryContainer,
      borderRadius: radius.lg,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      marginBottom: space.lg,
    },
    totalLabel: { ...typography.labelLarge, color: colors.onSecondaryContainer },
    totalValue: { ...typography.titleLarge, color: colors.onSecondaryContainer },
    switchGroup: { marginBottom: space.lg },
  });
}
