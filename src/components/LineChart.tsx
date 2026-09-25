// Ported from FuelTrackerClient.tsx's inline <svg> LineChart — same path math,
// react-native-svg primitives instead of DOM SVG elements.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { fmt } from '../lib/fuel-utils';
import { colors } from '../theme';

export function LineChart({
  points,
  color,
  yLabel,
  emptyHint,
}: {
  points: { x: string; y: number }[];
  color: string;
  yLabel: string;
  emptyHint: string;
}) {
  points = points.filter((p) => Number.isFinite(p.y));

  if (points.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Not enough data yet</Text>
        <Text style={styles.emptyHint}>{emptyHint}</Text>
      </View>
    );
  }

  const PAD = { t: 16, r: 24, b: 36, l: 52 };
  const W = 600;
  const H = 200;
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;

  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const pad5 = range * 0.15;

  const scaleY = (y: number) => PAD.t + CH - ((y - (minY - pad5)) / (range + pad5 * 2)) * CH;
  const scaleX = (i: number) => PAD.l + (i / (points.length - 1)) * CW;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
    .join(' ');
  const areaD = `${pathD} L ${scaleX(points.length - 1).toFixed(1)} ${(PAD.t + CH).toFixed(1)} L ${scaleX(0).toFixed(1)} ${(PAD.t + CH).toFixed(1)} Z`;

  const ticks = 4;
  const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
  const labelStep = Math.ceil(points.length / 6);

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={180}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const y = minY - pad5 + ((range + pad5 * 2) * i) / ticks;
        return (
          <React.Fragment key={i}>
            <Line
              x1={PAD.l} y1={scaleY(y)} x2={W - PAD.r} y2={scaleY(y)}
              stroke="rgba(255,255,255,0.08)" strokeWidth={1}
            />
            <SvgText x={PAD.l - 6} y={scaleY(y) + 4} textAnchor="end" fontSize={10} fill={colors.faint}>
              {fmt(y, 1)}
            </SvgText>
          </React.Fragment>
        );
      })}

      <Line
        x1={PAD.l} y1={scaleY(avg)} x2={W - PAD.r} y2={scaleY(avg)}
        stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.45}
      />
      <SvgText x={W - PAD.r + 2} y={scaleY(avg) + 4} fontSize={9} fill={color} opacity={0.6}>
        avg
      </SvgText>

      <Path d={areaD} fill={color} fillOpacity={0.08} />
      <Path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

      {points.map((p, i) => (
        <Circle key={i} cx={scaleX(i)} cy={scaleY(p.y)} r={3.5} fill={color} />
      ))}

      {points.map((p, i) => {
        if (i % labelStep !== 0 && i !== points.length - 1) return null;
        return (
          <SvgText key={i} x={scaleX(i)} y={H - 6} textAnchor="middle" fontSize={9} fill={colors.faint}>
            {p.x}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    color: colors.faint,
  },
  emptyHint: {
    fontSize: 11,
    color: colors.faint,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
