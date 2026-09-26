// Pulsing placeholder blocks for content that's still loading, used in place
// of a spinner so the loading state hints at the shape of the real content
// (dashboard stats, chart, list rows) instead of a blank screen.
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '../theme';

export function SkeletonBlock({ style }: { style?: ViewStyle }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { backgroundColor: colors.surface2, opacity },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <View style={styles.root}>
      {showHeader && (
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock style={{ width: 140, height: 20 }} />
            <SkeletonBlock style={{ width: 100, height: 12 }} />
          </View>
        </View>
      )}

      <View style={styles.statsGrid}>
        <SkeletonBlock style={styles.statTile} />
        <SkeletonBlock style={styles.statTile} />
        <SkeletonBlock style={styles.statTile} />
        <SkeletonBlock style={styles.statTile} />
      </View>

      <SkeletonBlock style={styles.chart} />

      <View style={{ gap: 12, marginTop: 20 }}>
        <SkeletonBlock style={styles.row} />
        <SkeletonBlock style={styles.row} />
        <SkeletonBlock style={styles.row} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 4 },
  root: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statTile: { flex: 1, minWidth: '45%', height: 74 },
  chart: { height: 220, marginBottom: 20 },
  row: { height: 52 },
});
