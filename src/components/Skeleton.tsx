// Pulsing placeholder blocks for content that's still loading, used in place
// of a spinner so the loading state hints at the shape of the real content
// (dashboard stats, chart, list rows) instead of a blank screen.
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, useColors } from '../theme';

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { backgroundColor: colors.surfaceContainerHigh, opacity }, style]} />;
}

export function DashboardSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your garage"
    >
      {showHeader && (
        <View style={styles.header}>
          <SkeletonBlock style={{ width: 160, height: 24 }} />
          <SkeletonBlock style={{ width: 110, height: 14, marginTop: space.sm }} />
        </View>
      )}
      <SkeletonBlock style={styles.hero} />
      <View style={styles.statRow}>
        <SkeletonBlock style={styles.stat} />
        <SkeletonBlock style={styles.stat} />
      </View>
      <SkeletonBlock style={styles.chart} />
      <SkeletonBlock style={styles.list} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.lg },
  root: { flex: 1, padding: space.lg },
  header: { marginBottom: space.xl, paddingTop: space.lg },
  hero: { height: 148, borderRadius: radius.xl },
  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  stat: { flex: 1, height: 80 },
  chart: { height: 260, marginTop: space.md },
  list: { height: 144, marginTop: space.xl },
});
