import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Alert, Modal, Animated,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { useEntitlement } from '../context/EntitlementContext';
import { useAccount } from '../context/AccountContext';
import { computeStats, summariseEfficiency, fmt, fmtDate, type FillStats } from '../lib/fuel-utils';
import { currencyByCode } from '../lib/currencies';
import {
  kmToDisplayDistance, litresToDisplayVolume, costPerKmToDisplay, kmplToMpg,
  distanceUnitLabel, volumeUnitLabel, efficiencyUnitLabel, costPerDistanceUnitLabel,
} from '../lib/units';
import type { Vehicle } from '../lib/types';
import { LineChart } from '../components/LineChart';
import { Icon } from '../components/Icon';
import {
  AppBar, IconButton, ChipGroup, Fab, EmptyState, Button, Touchable, Screen, SectionHeader,
} from '../components/ui';
import { DashboardSkeleton } from '../components/Skeleton';
import { AdBanner } from '../components/AdBanner';
import { radius, space, typography, useBottomInset, useThemedStyles, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;
type ChartMode = 'efficiency' | 'l100km' | 'spend';

function vehicleLabel(v: Vehicle): string {
  return v.nickname || `${v.make} ${v.model}`;
}

export default function DashboardScreen({ navigation }: Props) {
  const {
    vehicles, activeVehicleId, setActiveVehicleId, fills, currencyCode, unitSystem,
    removeFill, removeVehicle, dataLoading,
  } = useGarage();
  const { isPro } = useEntitlement();
  const { session } = useAccount();
  const bottom = useBottomInset();
  const { colors, styles } = useThemedStyles(makeStyles);
  const [chartMode, setChartMode] = useState<ChartMode>('efficiency');
  const [showVehicleMenu, setShowVehicleMenu] = useState(false);
  const [adHeight, setAdHeight] = useState(0);
  const [fabExtended, setFabExtended] = useState(true);
  const lastScrollY = useRef(0);
  const chartOpacity = useRef(new Animated.Value(1)).current;
  const chartReady = useRef(false);

  const isImperial = unitSystem === 'imperial';
  const distU = distanceUnitLabel(unitSystem);
  const volU = volumeUnitLabel(unitSystem);
  const effU = efficiencyUnitLabel(unitSystem);
  const costU = costPerDistanceUnitLabel(unitSystem);

  const currency = currencyByCode(currencyCode);
  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId);
  const fillStats = computeStats(fills);
  const overall = summariseEfficiency(fillStats);

  const avgL100 = overall ? overall.l100km : null;
  const avgKmpl = overall ? overall.kmpl : null;
  const avgEfficiency = avgKmpl === null ? null : (isImperial ? kmplToMpg(avgKmpl) : avgKmpl);
  const totalSpend = fillStats.reduce((a, s) => a + s.totalCost, 0);
  const avgCostKm = overall ? overall.costPerKm : null;
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
    efficiency: { label: effU, points: efficiencyPoints, color: colors.primary, hint: 'Log a 3rd fill-up to unlock the efficiency chart' },
    l100km: { label: 'L/100km', points: l100Points, color: colors.tertiary, hint: 'Log a 3rd fill-up to unlock the efficiency chart' },
    spend: { label: `Spend (${currency.code})`, points: spendPoints, color: colors.success, hint: 'Log your first fill-up to see spending over time' },
  };
  // No common imperial analogue for L/100km (see units.ts) — that tab only
  // makes sense in metric mode.
  const chartModes: ChartMode[] = isImperial ? ['efficiency', 'spend'] : ['efficiency', 'l100km', 'spend'];
  const safeChartMode = isImperial && chartMode === 'l100km' ? 'efficiency' : chartMode;
  const activeChart = chartConfig[safeChartMode];

  useEffect(() => {
    if (!chartReady.current) {
      chartReady.current = true;
      return;
    }
    chartOpacity.setValue(0.2);
    Animated.timing(chartOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [safeChartMode, chartOpacity]);

  function handleAddVehiclePress() {
    if (!isPro && vehicles.length >= 1) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('AddVehicle');
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastScrollY.current;
    if (Math.abs(delta) > 8) {
      setFabExtended(delta < 0 || y < 24);
      lastScrollY.current = y;
    }
  }

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
      <Screen>
        <EmptyState
          icon="car"
          title="No vehicle selected"
          body="Add a vehicle to start tracking fill-ups."
          action={<Button title="Add vehicle" icon="add" onPress={() => navigation.navigate('AddVehicle')} />}
        />
      </Screen>
    );
  }

  const subtitle = [activeVehicle.nickname ? `${activeVehicle.make} ${activeVehicle.model}` : null, activeVehicle.year]
    .filter(Boolean)
    .join(' · ');
  const history = fillStats.slice().reverse();

  function renderFill({ item, index }: { item: FillStats; index: number }) {
    const isFirst = index === 0;
    const isLast = index === history.length - 1;
    const meta = [
      `${Math.round(kmToDisplayDistance(item.fill.odometer, unitSystem)).toLocaleString()} ${distU}`,
      `${fmt(litresToDisplayVolume(item.fill.litres, unitSystem))} ${volU}`,
      item.fill.is_partial ? 'Partial' : null,
    ].filter(Boolean).join(' · ');
    const efficiency = item.kmpl ? `${fmt(isImperial ? kmplToMpg(item.kmpl) : item.kmpl, 1)} ${effU}` : null;
    const cost = `${currency.symbol}${fmt(item.totalCost)}`;
    return (
      <View style={[styles.historyRowWrap, isFirst && styles.historyFirst, isLast && styles.historyLast]}>
        {!isFirst ? <View style={styles.divider} /> : null}
        <Touchable
          onPress={() => navigation.navigate('AddFill', { editId: item.fill.id })}
          onLongPress={() => confirmDeleteFill(item.fill.id)}
          accessibilityLabel={`${fmtDate(item.fill.fill_date)}, ${meta}, ${cost}${efficiency ? `, ${efficiency}` : ''}`}
          accessibilityHint="Opens the fill-up for editing. Long press to delete."
          style={styles.historyRow}
        >
          <View style={styles.historyIcon}>
            <Icon name="gasStation" size={20} color={colors.onSecondaryContainer} />
          </View>
          <View style={styles.historyBody}>
            <Text style={styles.historyTitle}>{fmtDate(item.fill.fill_date)}</Text>
            <Text style={styles.historyMeta}>{meta}</Text>
          </View>
          <View style={styles.historyTrailing}>
            <Text style={styles.historyCost}>{cost}</Text>
            {efficiency ? <Text style={styles.historyMeta}>{efficiency}</Text> : null}
          </View>
        </Touchable>
      </View>
    );
  }

  const header = (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Average efficiency</Text>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue}>{avgEfficiency ? fmt(avgEfficiency, 1) : '—'}</Text>
          <Text style={styles.heroUnit}>{effU}</Text>
        </View>
        {!isImperial ? (
          <Text style={styles.heroSub}>
            {avgL100 ? `${fmt(avgL100, 1)} L/100km` : 'Needs two full fill-ups to calculate'}
          </Text>
        ) : !avgEfficiency ? (
          <Text style={styles.heroSub}>Needs two full fill-ups to calculate</Text>
        ) : null}
      </View>

      <View style={styles.statRow}>
        <View style={styles.statTile} accessible accessibilityLabel={`Total spend ${currency.symbol}${fmt(totalSpend)}`}>
          <Text style={styles.statLabel}>Total spend</Text>
          <Text style={styles.statValue}>{currency.symbol}{fmt(totalSpend)}</Text>
        </View>
        <View
          style={styles.statTile}
          accessible
          accessibilityLabel={`Cost ${costU} ${avgCostDistance ? `${currency.symbol}${fmt(avgCostDistance, 3)}` : 'not available'}`}
        >
          <Text style={styles.statLabel}>Cost {costU}</Text>
          <Text style={styles.statValue}>{avgCostDistance ? `${currency.symbol}${fmt(avgCostDistance, 3)}` : '—'}</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Trends</Text>
        <View style={styles.chartChips}>
          <ChipGroup
            options={chartModes.map((m) => ({ value: m, label: chartConfig[m].label }))}
            value={safeChartMode}
            onChange={setChartMode}
            accessibilityLabel="Chart type"
          />
        </View>
        <Animated.View style={{ opacity: chartOpacity }}>
          <LineChart points={activeChart.points} color={activeChart.color} yLabel={activeChart.label} emptyHint={activeChart.hint} />
        </Animated.View>
      </View>

      <SectionHeader
        title="Fill history"
        trailing={history.length ? <Text style={styles.count}>{history.length}</Text> : null}
      />
    </>
  );

  return (
    <Screen>
      <AppBar
        title={vehicleLabel(activeVehicle)}
        subtitle={subtitle || activeVehicle.fuel_type}
        onTitlePress={() => {
          if (vehicles.length > 1) setShowVehicleMenu(true);
          else navigation.navigate('AddVehicle', { editId: activeVehicle.id });
        }}
        titleAccessory={<Icon name={vehicles.length > 1 ? 'expandMore' : 'edit'} size={vehicles.length > 1 ? 24 : 18} color={colors.onSurfaceVariant} />}
        actions={(
          <>
            <IconButton
              icon="build"
              accessibilityLabel={isPro ? 'Maintenance' : 'Maintenance, Pro feature'}
              badge={!isPro ? 'lock' : undefined}
              onPress={() => navigation.navigate('Maintenance')}
            />
            <IconButton
              icon="add"
              accessibilityLabel={!isPro && vehicles.length >= 1 ? 'Add vehicle, Pro feature' : 'Add vehicle'}
              badge={!isPro && vehicles.length >= 1 ? 'lock' : undefined}
              onPress={handleAddVehiclePress}
            />
            <IconButton
              icon="settings"
              accessibilityLabel={session ? 'Settings, signed in' : 'Settings'}
              badge={session ? 'dot' : undefined}
              onPress={() => navigation.navigate('Settings')}
            />
          </>
        )}
      />

      <VehicleMenu
        visible={showVehicleMenu && vehicles.length > 1}
        vehicles={vehicles}
        activeVehicleId={activeVehicleId}
        onClose={() => setShowVehicleMenu(false)}
        onSelect={(id) => { setActiveVehicleId(id); setShowVehicleMenu(false); }}
        onEdit={(id) => { setShowVehicleMenu(false); navigation.navigate('AddVehicle', { editId: id }); }}
        onDelete={(v) => confirmDeleteVehicle(v.id, vehicleLabel(v))}
      />

      {dataLoading ? (
        <DashboardSkeleton showHeader={false} />
      ) : (
        <FlatList
          style={styles.flex}
          data={history}
          keyExtractor={(s) => s.fill.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: adHeight + bottom + 96 }]}
          ListHeaderComponent={header}
          renderItem={renderFill}
          onScroll={handleScroll}
          scrollEventThrottle={32}
          ListEmptyComponent={(
            <EmptyState
              icon="gasStation"
              title="No fill-ups yet"
              body="Log your first fill-up to start tracking efficiency and spend."
            />
          )}
        />
      )}

      <Fab
        icon="add"
        label="Log fill-up"
        extended={fabExtended}
        onPress={() => navigation.navigate('AddFill')}
        style={[styles.fab, { bottom: bottom + adHeight + space.lg }]}
      />

      <View
        pointerEvents="box-none"
        style={[styles.adSlot, { paddingBottom: bottom, backgroundColor: adHeight > 0 ? colors.surface : 'transparent' }]}
        onLayout={(e) => setAdHeight(Math.max(0, e.nativeEvent.layout.height - bottom))}
      >
        <AdBanner />
      </View>
    </Screen>
  );
}

/** Material 3 menu anchored under the app bar title. Fades and scales in from the top. */
function VehicleMenu({ visible, vehicles, activeVehicleId, onClose, onSelect, onEdit, onDelete }: {
  visible: boolean;
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (v: Vehicle) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, styles } = useThemedStyles(makeStyles);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 0 }).start();
    }
  }, [visible, anim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.menuBackdrop} onPress={onClose} accessibilityLabel="Close vehicle menu" />
      <Animated.View
        style={[
          styles.menu,
          {
            top: insets.top + 64,
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          },
        ]}
      >
        <Text style={styles.menuTitle}>Your vehicles</Text>
        {vehicles.map((v) => {
          const active = v.id === activeVehicleId;
          const label = vehicleLabel(v);
          return (
            <View key={v.id} style={styles.menuRow}>
              <Touchable
                onPress={() => onSelect(v.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={label}
                style={[styles.menuItem, active && { backgroundColor: colors.secondaryContainer }]}
              >
                <Icon name="car" size={20} color={active ? colors.onSecondaryContainer : colors.onSurfaceVariant} />
                <Text
                  style={[styles.menuItemText, { color: active ? colors.onSecondaryContainer : colors.onSurface }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {active ? <Icon name="check" size={20} color={colors.onSecondaryContainer} /> : null}
              </Touchable>
              <IconButton icon="edit" accessibilityLabel={`Edit ${label}`} onPress={() => onEdit(v.id)} />
              <IconButton icon="delete" accessibilityLabel={`Delete ${label}`} color={colors.error} onPress={() => onDelete(v)} />
            </View>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    listContent: { paddingHorizontal: space.lg, paddingTop: space.xs, flexGrow: 1 },

    hero: {
      backgroundColor: colors.primaryContainer,
      borderRadius: radius.xl,
      paddingHorizontal: space.xl,
      paddingVertical: space.xl,
    },
    heroLabel: { ...typography.labelLarge, color: colors.onPrimaryContainer, opacity: 0.8 },
    heroValueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
    heroValue: { fontSize: 48, lineHeight: 56, fontWeight: '400', letterSpacing: -0.5, color: colors.onPrimaryContainer },
    heroUnit: { ...typography.titleMedium, color: colors.onPrimaryContainer },
    heroSub: { ...typography.bodyMedium, color: colors.onPrimaryContainer, opacity: 0.8, marginTop: space.xs },

    statRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
    statTile: {
      flex: 1,
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.lg,
      padding: space.lg,
      gap: space.xs,
    },
    statLabel: { ...typography.labelMedium, color: colors.onSurfaceVariant },
    statValue: { ...typography.titleLarge, color: colors.onSurface },

    chartCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.lg,
      padding: space.lg,
      marginTop: space.md,
    },
    cardTitle: { ...typography.titleMedium, color: colors.onSurface },
    chartChips: { marginTop: space.md, marginBottom: space.sm },
    count: { ...typography.labelLarge, color: colors.onSurfaceVariant },

    historyRowWrap: { backgroundColor: colors.surfaceContainer, overflow: 'hidden' },
    historyFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
    historyLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginLeft: 72 },
    historyRow: {
      flexDirection: 'row', alignItems: 'center', gap: space.lg,
      paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 72,
    },
    historyIcon: {
      width: 40, height: 40, borderRadius: radius.full,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer,
    },
    historyBody: { flex: 1, flexShrink: 1 },
    historyTitle: { ...typography.bodyLarge, color: colors.onSurface },
    historyMeta: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
    historyTrailing: { alignItems: 'flex-end' },
    historyCost: { ...typography.titleMedium, color: colors.onSurface },

    fab: { position: 'absolute', right: space.lg },
    adSlot: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },

    menuBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
    menu: {
      position: 'absolute',
      left: space.lg,
      right: space.lg,
      maxWidth: 420,
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.lg,
      paddingVertical: space.sm,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    },
    menuTitle: { ...typography.labelLarge, color: colors.onSurfaceVariant, paddingHorizontal: space.lg, paddingVertical: space.sm },
    menuRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.sm, paddingRight: space.xs },
    menuItem: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md,
      minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.full,
    },
    menuItemText: { ...typography.bodyLarge, flex: 1 },
  });
}
