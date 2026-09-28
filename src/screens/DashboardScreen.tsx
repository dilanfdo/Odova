import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Alert, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { useEntitlement } from '../context/EntitlementContext';
import { useAccount } from '../context/AccountContext';
import { computeStats, fmt, fmtDate } from '../lib/fuel-utils';
import { currencyByCode } from '../lib/currencies';
import {
  kmToDisplayDistance, litresToDisplayVolume, costPerKmToDisplay, kmplToMpg,
  distanceUnitLabel, volumeUnitLabel, efficiencyUnitLabel, costPerDistanceUnitLabel,
} from '../lib/units';
import { LineChart } from '../components/LineChart';
import { StatTile, Card } from '../components/ui';
import { DashboardSkeleton } from '../components/Skeleton';
import { AdBanner } from '../components/AdBanner';
import { useThemedStyles, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;
type ChartMode = 'efficiency' | 'l100km' | 'spend';

export default function DashboardScreen({ navigation }: Props) {
  const {
    vehicles, activeVehicleId, setActiveVehicleId, fills, currencyCode, unitSystem,
    removeFill, removeVehicle, dataLoading,
  } = useGarage();
  const { isPro } = useEntitlement();
  const { session } = useAccount();
  const insets = useSafeAreaInsets();
  const { colors, styles } = useThemedStyles(makeStyles);
  const [chartMode, setChartMode] = useState<ChartMode>('efficiency');
  const isImperial = unitSystem === 'imperial';
  const distU = distanceUnitLabel(unitSystem);
  const volU = volumeUnitLabel(unitSystem);
  const effU = efficiencyUnitLabel(unitSystem);
  const costU = costPerDistanceUnitLabel(unitSystem);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);

  function handleAddVehiclePress() {
    if (!isPro && vehicles.length >= 1) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('AddVehicle');
  }

  const currency = currencyByCode(currencyCode);
  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId);
  const fillStats = computeStats(fills);
  const validStats = fillStats.filter((s) => s.l100km !== null && !s.isFirst);

  const avgL100 = validStats.length ? validStats.reduce((a, s) => a + s.l100km!, 0) / validStats.length : null;
  const avgKmpl = validStats.length ? validStats.reduce((a, s) => a + s.kmpl!, 0) / validStats.length : null;
  const avgEfficiency = avgKmpl === null ? null : (isImperial ? kmplToMpg(avgKmpl) : avgKmpl);
  const totalSpend = fillStats.reduce((a, s) => a + s.totalCost, 0);
  const totalKm = fillStats.filter((s) => s.distance).reduce((a, s) => a + s.distance!, 0);
  const avgCostKm = totalKm > 0 ? totalSpend / totalKm : null;
  const avgCostDistance = avgCostKm === null ? null : costPerKmToDisplay(avgCostKm, unitSystem);

  const efficiencyPoints = fillStats
    .filter((s) => s.kmpl !== null)
    .map((s) => ({ x: s.fill.fill_date.slice(5), y: isImperial ? kmplToMpg(s.kmpl!) : s.kmpl! }));
  const l100Points = fillStats.filter((s) => s.l100km !== null).map((s) => ({ x: s.fill.fill_date.slice(5), y: s.l100km! }));
  const spendPoints = (() => {
    let cumulative = 0;
    return fillStats.map((s) => { cumulative += s.totalCost; return { x: s.fill.fill_date.slice(5), y: cumulative }; });
  })();

  const chartConfig: Record<ChartMode, { label: string; points: { x: string; y: number }[]; color: string; hint: string }> = {
    efficiency: { label: effU, points: efficiencyPoints, color: colors.accent, hint: 'Log a 3rd fill-up to unlock the efficiency chart' },
    l100km: { label: 'L/100km', points: l100Points, color: colors.amber, hint: 'Log a 3rd fill-up to unlock the efficiency chart' },
    spend: { label: `Spend (${currency.code})`, points: spendPoints, color: colors.green, hint: 'Log your first fill-up to see spending over time' },
  };
  // No common imperial analogue for L/100km (see units.ts) — that tab only
  // makes sense in metric mode.
  const chartModes: ChartMode[] = isImperial ? ['efficiency', 'spend'] : ['efficiency', 'l100km', 'spend'];
  const safeChartMode = isImperial && chartMode === 'l100km' ? 'efficiency' : chartMode;
  const activeChart = chartConfig[safeChartMode];

  function confirmDeleteFill(id: string) {
    Alert.alert('Delete this fill-up?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeFill(id) },
    ]);
  }

  function confirmDeleteVehicle(id: string, label: string) {
    Alert.alert(
      `Remove ${label}?`,
      'This deletes the vehicle and all of its fill-up history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void removeVehicle(id) },
      ]
    );
  }

  if (!activeVehicle) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Text style={styles.emptyText}>No vehicle selected.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          style={styles.vehicleSwitcher}
          onPress={() => {
            if (vehicles.length > 1) setShowVehiclePicker((s) => !s);
            else navigation.navigate('AddVehicle', { editId: activeVehicle.id });
          }}
        >
          <Text style={styles.vehicleName}>
            {activeVehicle.nickname || `${activeVehicle.make} ${activeVehicle.model}`}
          </Text>
          <Text style={styles.vehicleSub}>
            {activeVehicle.make} {activeVehicle.model} {activeVehicle.year ? `· ${activeVehicle.year}` : ''} {vehicles.length > 1 ? '▾' : '✎'}
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          <HeaderAction
            icon="🔧" label="Service" locked={!isPro}
            onPress={() => navigation.navigate('Maintenance')}
          />
          <HeaderAction
            icon="＋" label="Vehicle" locked={!isPro && vehicles.length >= 1}
            onPress={handleAddVehiclePress}
          />
          <HeaderAction
            icon="⚙" label="Settings" signedIn={Boolean(session)}
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </View>

      <Modal
        visible={showVehiclePicker && vehicles.length > 1}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVehiclePicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowVehiclePicker(false)}>
          <View style={[styles.vehiclePicker, { top: insets.top + 68 }]}>
            {vehicles.map((v, i) => {
              const label = v.nickname || `${v.make} ${v.model}`;
              return (
                <View key={v.id} style={[styles.vehiclePickerRow, i > 0 && styles.vehiclePickerRowDivider]}>
                  <Pressable
                    style={styles.vehiclePickerName}
                    onPress={() => { setActiveVehicleId(v.id); setShowVehiclePicker(false); }}
                  >
                    <Text style={[styles.vehiclePickerText, v.id === activeVehicleId && { color: colors.accent }]}>
                      {label}
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    style={styles.vehiclePickerAction}
                    onPress={() => { setShowVehiclePicker(false); navigation.navigate('AddVehicle', { editId: v.id }); }}
                  >
                    <Text style={styles.vehiclePickerActionText}>✎</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    style={styles.vehiclePickerAction}
                    onPress={() => confirmDeleteVehicle(v.id, label)}
                  >
                    <Text style={[styles.vehiclePickerActionText, { color: colors.red }]}>🗑</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {dataLoading ? (
        <DashboardSkeleton showHeader={false} />
      ) : (
        <FlatList
          data={fillStats.slice().reverse()}
          keyExtractor={(s) => s.fill.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <View style={styles.statsGrid}>
                <StatTile label={`Avg ${effU}`} value={avgEfficiency ? fmt(avgEfficiency, 1) : '—'} />
                {!isImperial && <StatTile label="Avg L/100km" value={avgL100 ? fmt(avgL100, 1) : '—'} />}
                <StatTile label="Total Spend" value={`${currency.symbol}${fmt(totalSpend)}`} />
                <StatTile label={`Cost ${costU}`} value={avgCostDistance ? `${currency.symbol}${fmt(avgCostDistance, 3)}` : '—'} />
              </View>

              <Card style={styles.card}>
                <View style={styles.chartTabs}>
                  {chartModes.map((mode) => (
                    <Pressable key={mode} onPress={() => setChartMode(mode)} style={styles.chartTab}>
                      <Text style={[styles.chartTabText, safeChartMode === mode && { color: colors.text }]}>
                        {chartConfig[mode].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <LineChart points={activeChart.points} color={activeChart.color} yLabel={activeChart.label} emptyHint={activeChart.hint} />
              </Card>

              <Text style={styles.sectionTitle}>Fill History</Text>
            </>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('AddFill', { editId: item.fill.id })}
              onLongPress={() => confirmDeleteFill(item.fill.id)}
              style={styles.fillRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.fillDate}>{fmtDate(item.fill.fill_date)}</Text>
                <Text style={styles.fillMeta}>
                  {Math.round(kmToDisplayDistance(item.fill.odometer, unitSystem)).toLocaleString()} {distU} · {fmt(litresToDisplayVolume(item.fill.litres, unitSystem))} {volU}
                  {item.fill.is_partial ? ' · partial' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.fillCost}>{currency.symbol}{fmt(item.totalCost)}</Text>
                {item.kmpl ? (
                  <Text style={styles.fillEff}>
                    {fmt(isImperial ? kmplToMpg(item.kmpl) : item.kmpl, 1)} {effU}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No fill-ups logged yet.</Text>
            </View>
          }
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: 24 + insets.bottom + bannerHeight }]}
        onPress={() => navigation.navigate('AddFill')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <AdBanner onHeightChange={setBannerHeight} />
    </SafeAreaView>
  );
}

function HeaderAction({ icon, label, locked, signedIn, onPress }: {
  icon: string; label: string; locked?: boolean; signedIn?: boolean; onPress: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={styles.headerAction}>
      <Text style={styles.headerActionIcon}>{icon}</Text>
      <Text style={styles.headerActionLabel}>{label}</Text>
      {locked && (
        <View style={styles.lockBadge}>
          <Text style={styles.lockBadgeText}>🔒</Text>
        </View>
      )}
      {signedIn && <View style={styles.signedInBadge} />}
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
    emptyText: { color: colors.faint, fontSize: 13 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    vehicleSwitcher: { flex: 1, marginRight: 12 },
    vehicleName: { fontSize: 19, fontWeight: '800', color: colors.text },
    vehicleSub: { fontSize: 12, color: colors.faint, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerAction: {
      width: 58, paddingVertical: 8, borderRadius: 12, gap: 2,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    },
    headerActionIcon: { fontSize: 17, color: colors.text },
    headerActionLabel: {
      fontSize: 8.5, fontWeight: '700', letterSpacing: 0.3,
      textTransform: 'uppercase', color: colors.faint,
    },
    lockBadge: {
      position: 'absolute', top: -5, right: -5,
      width: 17, height: 17, borderRadius: 9,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.bg,
    },
    lockBadgeText: { fontSize: 7.5, lineHeight: 8 },
    signedInBadge: {
      position: 'absolute', top: -3, right: -3,
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: colors.green, borderWidth: 2, borderColor: colors.bg,
    },
    pickerBackdrop: { flex: 1, backgroundColor: colors.scrim },
    vehiclePicker: {
      position: 'absolute', left: 16, right: 16,
      backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    vehiclePickerRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, paddingHorizontal: 12,
    },
    vehiclePickerRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    vehiclePickerName: { flex: 1 },
    vehiclePickerText: { color: colors.text, fontSize: 14 },
    vehiclePickerAction: { paddingHorizontal: 10, paddingVertical: 4 },
    vehiclePickerActionText: { fontSize: 15, color: colors.faint },
    listContent: { padding: 16, paddingBottom: 100 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    card: { padding: 12, marginBottom: 20 },
    chartTabs: { flexDirection: 'row', gap: 16, marginBottom: 8 },
    chartTab: { paddingVertical: 4 },
    chartTabText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.faint },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
    fillRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    fillDate: { fontSize: 14, color: colors.text, fontWeight: '600' },
    fillMeta: { fontSize: 12, color: colors.faint, marginTop: 2 },
    fillCost: { fontSize: 14, color: colors.text, fontWeight: '700' },
    fillEff: { fontSize: 11, color: colors.muted, marginTop: 2 },
    fab: {
      position: 'absolute', right: 20, bottom: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    fabText: { fontSize: 28, color: colors.onAccent, fontWeight: '700', marginTop: -2 },
  });
}
