import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { useEntitlement } from '../context/EntitlementContext';
import { computeStats, fmt, fmtDate } from '../lib/fuel-utils';
import { currencyByCode } from '../lib/currencies';
import { LineChart } from '../components/LineChart';
import { StatTile } from '../components/ui';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;
type ChartMode = 'kmpl' | 'l100km' | 'spend';

export default function DashboardScreen({ navigation }: Props) {
  const { vehicles, activeVehicleId, setActiveVehicleId, fills, currencyCode, removeFill, dataLoading } = useGarage();
  const { isPro } = useEntitlement();
  const [chartMode, setChartMode] = useState<ChartMode>('kmpl');
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

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
  const totalSpend = fillStats.reduce((a, s) => a + s.totalCost, 0);
  const totalKm = fillStats.filter((s) => s.distance).reduce((a, s) => a + s.distance!, 0);
  const avgCostKm = totalKm > 0 ? totalSpend / totalKm : null;

  const kmplPoints = fillStats.filter((s) => s.kmpl !== null).map((s) => ({ x: s.fill.fill_date.slice(5), y: s.kmpl! }));
  const l100Points = fillStats.filter((s) => s.l100km !== null).map((s) => ({ x: s.fill.fill_date.slice(5), y: s.l100km! }));
  const spendPoints = (() => {
    let cumulative = 0;
    return fillStats.map((s) => { cumulative += s.totalCost; return { x: s.fill.fill_date.slice(5), y: cumulative }; });
  })();

  const chartConfig: Record<ChartMode, { label: string; points: { x: string; y: number }[]; color: string; hint: string }> = {
    kmpl: { label: 'km/L', points: kmplPoints, color: colors.accent, hint: 'Log a 3rd fill-up to unlock the efficiency chart' },
    l100km: { label: 'L/100km', points: l100Points, color: colors.amber, hint: 'Log a 3rd fill-up to unlock the efficiency chart' },
    spend: { label: `Spend (${currency.code})`, points: spendPoints, color: colors.green, hint: 'Log your first fill-up to see spending over time' },
  };
  const activeChart = chartConfig[chartMode];

  function confirmDeleteFill(id: string) {
    Alert.alert('Delete this fill-up?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeFill(id) },
    ]);
  }

  if (!activeVehicle) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Text style={styles.emptyText}>No vehicle selected.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable style={styles.vehicleSwitcher} onPress={() => setShowVehiclePicker((s) => !s)}>
          <Text style={styles.vehicleName}>
            {activeVehicle.nickname || `${activeVehicle.make} ${activeVehicle.model}`}
          </Text>
          <Text style={styles.vehicleSub}>
            {activeVehicle.make} {activeVehicle.model} {activeVehicle.year ? `· ${activeVehicle.year}` : ''} {vehicles.length > 1 ? '▾' : ''}
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('Maintenance')} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>Maintenance{!isPro ? ' 🔒' : ''}</Text>
          </Pressable>
          <Pressable onPress={handleAddVehiclePress} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>+ Vehicle{!isPro && vehicles.length >= 1 ? ' 🔒' : ''}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>Settings</Text>
          </Pressable>
        </View>
      </View>

      {showVehiclePicker && vehicles.length > 1 && (
        <View style={styles.vehiclePicker}>
          {vehicles.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => { setActiveVehicleId(v.id); setShowVehiclePicker(false); }}
              style={styles.vehiclePickerRow}
            >
              <Text style={[styles.vehiclePickerText, v.id === activeVehicleId && { color: colors.accent }]}>
                {v.nickname || `${v.make} ${v.model}`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={fillStats.slice().reverse()}
        keyExtractor={(s) => s.fill.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.statsGrid}>
              <StatTile label="Avg km/L" value={avgKmpl ? fmt(avgKmpl, 1) : '—'} />
              <StatTile label="Avg L/100km" value={avgL100 ? fmt(avgL100, 1) : '—'} />
              <StatTile label="Total Spend" value={`${currency.symbol}${fmt(totalSpend)}`} />
              <StatTile label="Cost / km" value={avgCostKm ? `${currency.symbol}${fmt(avgCostKm, 3)}` : '—'} />
            </View>

            <View style={styles.card}>
              <View style={styles.chartTabs}>
                {(Object.keys(chartConfig) as ChartMode[]).map((mode) => (
                  <Pressable key={mode} onPress={() => setChartMode(mode)} style={styles.chartTab}>
                    <Text style={[styles.chartTabText, chartMode === mode && { color: colors.text }]}>
                      {chartConfig[mode].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <LineChart points={activeChart.points} color={activeChart.color} yLabel={activeChart.label} emptyHint={activeChart.hint} />
            </View>

            <Text style={styles.sectionTitle}>Fill History</Text>
          </>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => confirmDeleteFill(item.fill.id)} style={styles.fillRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fillDate}>{fmtDate(item.fill.fill_date)}</Text>
              <Text style={styles.fillMeta}>
                {item.fill.odometer.toLocaleString()} km · {fmt(item.fill.litres)} L
                {item.fill.is_partial ? ' · partial' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.fillCost}>{currency.symbol}{fmt(item.totalCost)}</Text>
              {item.kmpl ? <Text style={styles.fillEff}>{fmt(item.kmpl, 1)} km/L</Text> : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !dataLoading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No fill-ups logged yet.</Text>
            </View>
          ) : null
        }
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddFill')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { color: colors.faint, fontSize: 13 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  vehicleSwitcher: { flex: 1 },
  vehicleName: { fontSize: 18, fontWeight: '800', color: colors.text },
  vehicleSub: { fontSize: 12, color: colors.faint, marginTop: 2 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: 190 },
  iconBtn: { paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.border },
  iconBtnText: { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  vehiclePicker: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  vehiclePickerRow: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  vehiclePickerText: { color: colors.text, fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 100 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 20 },
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
  fabText: { fontSize: 28, color: '#0b0f19', fontWeight: '700', marginTop: -2 },
});
