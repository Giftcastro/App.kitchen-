/**
 * Report charts drawn with react-native-svg: BarChart (Graphics/BarChartDrawable
 * geometry — value labels above, day labels below, max bar width 38, 6pt
 * corners) and BarList, ranked horizontal bars for comparing named rows.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Text } from './AppText';

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

/** Placeholder the same height as the chart, so the layout doesn't jump. */
function NoData({ height }: { height: number }) {
  return (
    <View style={[styles.noData, { height }]}>
      <Text style={styles.noDataText}>No data for this range</Text>
    </View>
  );
}

/** Vertical bars sized to the container width (measured on layout, so nothing draws until then). */
export function BarChart({ bars, height = 200, labelColor = 'gray' }: { bars: ChartDatum[]; height?: number; labelColor?: string }) {
  const [width, setWidth] = useState(0);
  if (bars.length === 0) return <NoData height={height} />;
  const max = Math.max(...bars.map(b => b.value), 1);
  const labelArea = 26;
  const valueArea = 18;
  const chartTop = 8;
  const chartBottom = height - labelArea;
  const chartHeight = chartBottom - chartTop - valueArea;
  const slot = width / bars.length;
  const barWidth = Math.min(38, slot * 0.55);
  return (
    <View style={{ height }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {bars.map((bar, i) => {
            const barHeight = Math.max((bar.value / max) * chartHeight, 2);
            const center = slot * i + slot / 2;
            const y = chartBottom - barHeight;
            return (
              <G key={`${bar.label}-${i}`}>
                <Rect x={center - barWidth / 2} y={y} width={barWidth} height={barHeight} rx={6} ry={6} fill={bar.color} />
                <SvgText x={center} y={y - 4} fontSize={10} fontFamily="OpenSans_400Regular" fill={labelColor} textAnchor="middle">
                  {Math.round(bar.value)}
                </SvgText>
                <SvgText x={center} y={chartBottom + 16} fontSize={10} fontFamily="OpenSans_400Regular" fill={labelColor} textAnchor="middle">
                  {bar.label}
                </SvgText>
              </G>
            );
          })}
          <Line x1={0} y1={chartBottom} x2={width} y2={chartBottom} stroke={labelColor} strokeOpacity={0.3} strokeWidth={1} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noData: { alignItems: 'center', justifyContent: 'center' },
  noDataText: { fontSize: 13, color: 'gray' },
});

export interface BarRow {
  label: string;
  value: number;
  /** Text shown on the right, e.g. "R1 240.00" or "42%". */
  display: string;
  /** Small second line under the label. */
  sub?: string;
}

/**
 * Ranked horizontal bars — the readable way to compare named categories on
 * a phone (companies, dishes, categories): label and value on one line, a
 * proportional bar underneath. `max` lets percentages scale to 100.
 */
export function BarList({
  rows,
  color,
  trackColor,
  textColor,
  mutedColor,
  max,
  emptyText = 'No data for this range',
}: {
  rows: BarRow[];
  color: string;
  trackColor: string;
  textColor: string;
  mutedColor: string;
  max?: number;
  emptyText?: string;
}) {
  if (rows.length === 0) return <Text style={[barStyles.empty, { color: mutedColor }]}>{emptyText}</Text>;
  const top = max ?? Math.max(...rows.map(r => r.value), 1);
  return (
    <View style={barStyles.list}>
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={barStyles.row}>
          <View style={barStyles.labels}>
            <View style={barStyles.flex}>
              <Text style={[barStyles.label, { color: textColor }]} numberOfLines={1}>
                {r.label}
              </Text>
              {!!r.sub && (
                <Text style={[barStyles.sub, { color: mutedColor }]} numberOfLines={1}>
                  {r.sub}
                </Text>
              )}
            </View>
            <Text style={[barStyles.value, { color: textColor }]}>{r.display}</Text>
          </View>
          <View style={[barStyles.track, { backgroundColor: trackColor }]}>
            <View style={[barStyles.fill, { backgroundColor: color, width: `${Math.max(2, Math.min(100, (r.value / top) * 100))}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const barStyles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 12 },
  row: { gap: 5 },
  labels: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 11 },
  value: { fontSize: 13, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  empty: { fontSize: 13 },
});
