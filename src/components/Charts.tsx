/**
 * Graphics/BarChartDrawable + PieChartDrawable, drawn with react-native-svg.
 * Same geometry: bars with value labels above and day labels below (max bar
 * width 38, 6pt corners); a donut whose hole matches the card behind it.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Text } from './AppText';

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

function NoData({ height }: { height: number }) {
  return (
    <View style={[styles.noData, { height }]}>
      <Text style={styles.noDataText}>No data for this range</Text>
    </View>
  );
}

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

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
}

export function DonutChart({ slices, size = 180, holeColor }: { slices: ChartDatum[]; size?: number; holeColor: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (slices.length === 0 || total <= 0) return <NoData height={size} />;
  const diameter = size - 16;
  const r = diameter / 2;
  const c = size / 2;
  let start = 0;
  return (
    <Svg width={size} height={size}>
      {slices.length === 1 ? (
        <Circle cx={c} cy={c} r={r} fill={slices[0].color} />
      ) : (
        slices.map((slice, i) => {
          const sweep = (slice.value / total) * 360;
          const d = arcPath(c, c, r, start, start + sweep);
          start += sweep;
          return <Path key={`${slice.label}-${i}`} d={d} fill={slice.color} />;
        })
      )}
      <Circle cx={c} cy={c} r={r * 0.45} fill={holeColor} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  noData: { alignItems: 'center', justifyContent: 'center' },
  noDataText: { fontSize: 13, color: 'gray' },
});
