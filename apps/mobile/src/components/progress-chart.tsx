import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { AnalysisChart } from '@fitness/ai';
import { useAppTheme } from './theme-provider';

const chartHeight = 230;
const padding = { bottom: 40, left: 48, right: 14, top: 14 };

type ChartPoint = { x: string | number; y: number };
type NormalizedChart = {
  type: 'line' | 'bar' | 'scatter';
  title: string;
  xAxis: { label: string; scale: 'category' | 'linear' | 'time' };
  yAxis: { label: string; unit?: string };
  series: { name: string; points: ChartPoint[] }[];
};

function normalizeChart(chart: AnalysisChart): NormalizedChart {
  if ('series' in chart) return chart;
  return {
    type: 'line',
    title: chart.title,
    xAxis: { label: 'Date', scale: 'time' },
    yAxis: { label: chart.metric, unit: chart.unit },
    series: [{ name: chart.metric, points: chart.points }],
  };
}

function formatValue(value: number) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (magnitude >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function numericX(point: ChartPoint, index: number, scale: NormalizedChart['xAxis']['scale']) {
  if (scale === 'category') return index;
  const value =
    scale === 'time' && typeof point.x === 'string' ? Date.parse(point.x) : Number(point.x);
  return Number.isFinite(value) ? value : index;
}

function formatX(value: string | number, scale: NormalizedChart['xAxis']['scale']) {
  if (scale === 'time') {
    const timestamp = typeof value === 'number' ? value : Date.parse(value);
    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
  }
  return String(value);
}

export function ProgressChart({
  chart: rawChart,
  compact = false,
}: {
  chart: AnalysisChart;
  compact?: boolean;
}) {
  const chart = normalizeChart(rawChart);
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const allPoints = chart.series.flatMap((series) => series.points);
  const values = allPoints.map((point) => point.y);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 0;
  const spread = rawMax - rawMin;
  const yPadding = spread > 0 ? spread * 0.12 : Math.max(Math.abs(rawMax) * 0.1, 1);
  const minY = chart.type === 'bar' ? Math.min(0, rawMin) : rawMin - yPadding;
  const maxY = chart.type === 'bar' ? Math.max(0, rawMax) || 1 : rawMax + yPadding;
  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const categories = [...new Set(allPoints.map((point) => String(point.x)))];
  const numericValues = allPoints.map((point, index) => numericX(point, index, chart.xAxis.scale));
  const minX = numericValues.length ? Math.min(...numericValues) : 0;
  const maxX = numericValues.length ? Math.max(...numericValues) : 1;
  const xAt = (point: ChartPoint, index: number) => {
    if (chart.xAxis.scale === 'category') {
      const categoryIndex = categories.indexOf(String(point.x));
      return (
        padding.left +
        (categories.length === 1
          ? plotWidth / 2
          : (categoryIndex / (categories.length - 1)) * plotWidth)
      );
    }
    const value = numericX(point, index, chart.xAxis.scale);
    return (
      padding.left + (maxX === minX ? plotWidth / 2 : ((value - minX) / (maxX - minX)) * plotWidth)
    );
  };
  const yAt = (value: number) => padding.top + ((maxY - value) / (maxY - minY)) * plotHeight;
  const palette = [
    colors.accent,
    '#3B82F6',
    '#F97316',
    '#EC4899',
    '#8B5CF6',
    '#14B8A6',
    '#EAB308',
    '#EF4444',
  ];
  const labelPoints = allPoints.length
    ? [allPoints[0], allPoints[Math.floor((allPoints.length - 1) / 2)], allPoints.at(-1)!]
    : [];
  const xLabels = [...new Map(labelPoints.map((point) => [String(point.x), point])).values()];

  return (
    <View
      accessibilityLabel={`${chart.title}, ${chart.type} chart with ${chart.series.length} series and ${allPoints.length} data points`}
      accessible
      className={compact ? 'mt-3 w-full' : 'mt-5 w-full'}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Text className="text-base font-black text-ink dark:text-ink-dark">{chart.title}</Text>
      <Text className="mt-0.5 text-xs text-muted dark:text-muted-dark">
        {chart.yAxis.label}
        {chart.yAxis.unit ? ` · ${chart.yAxis.unit}` : ''} by {chart.xAxis.label}
      </Text>
      {chart.series.length > 1 ? (
        <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
          {chart.series.map((series, index) => (
            <View className="flex-row items-center gap-1.5" key={`${series.name}-${index}`}>
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette[index] }}
              />
              <Text className="text-[11px] text-muted dark:text-muted-dark">{series.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {allPoints.length ? (
        width > 0 ? (
          <Svg height={chartHeight} width={width}>
            {[0, 0.5, 1].map((fraction) => {
              const y = padding.top + fraction * plotHeight;
              const value = maxY - fraction * (maxY - minY);
              return (
                <G key={fraction}>
                  <Line
                    stroke={colors.line}
                    strokeDasharray="3 5"
                    strokeWidth={1}
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                  />
                  <SvgText
                    fill={colors.muted}
                    fontSize={10}
                    textAnchor="end"
                    x={padding.left - 7}
                    y={y + 3}
                  >
                    {formatValue(value)}
                  </SvgText>
                </G>
              );
            })}
            {chart.type === 'bar'
              ? chart.series.flatMap((series, seriesIndex) => {
                  const slotWidth = plotWidth / Math.max(categories.length, 1);
                  const groupWidth = Math.min(slotWidth * 0.72, 48);
                  const barWidth = groupWidth / chart.series.length;
                  return series.points.map((point, pointIndex) => {
                    const center = xAt(point, pointIndex);
                    const valueY = yAt(point.y);
                    const zeroY = yAt(0);
                    return (
                      <Rect
                        fill={palette[seriesIndex]}
                        height={Math.max(1, Math.abs(zeroY - valueY))}
                        key={`${series.name}-${point.x}-${pointIndex}`}
                        rx={2}
                        width={Math.max(2, barWidth - 2)}
                        x={center - groupWidth / 2 + seriesIndex * barWidth + 1}
                        y={Math.min(valueY, zeroY)}
                      />
                    );
                  });
                })
              : chart.series.map((series, seriesIndex) => {
                  const path = series.points
                    .map(
                      (point, pointIndex) =>
                        `${pointIndex ? 'L' : 'M'} ${xAt(point, pointIndex)} ${yAt(point.y)}`,
                    )
                    .join(' ');
                  const pointStride = Math.max(1, Math.ceil(allPoints.length / 80));
                  return (
                    <G key={`${series.name}-${seriesIndex}`}>
                      {chart.type === 'line' ? (
                        <Path
                          d={path}
                          fill="none"
                          stroke={palette[seriesIndex]}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                        />
                      ) : null}
                      {series.points.map((point, pointIndex) =>
                        pointIndex % pointStride === 0 ||
                        pointIndex === series.points.length - 1 ? (
                          <Circle
                            cx={xAt(point, pointIndex)}
                            cy={yAt(point.y)}
                            fill={colors.panel}
                            key={`${point.x}-${pointIndex}`}
                            r={chart.type === 'scatter' ? 4 : 3.5}
                            stroke={palette[seriesIndex]}
                            strokeWidth={2.5}
                          />
                        ) : null,
                      )}
                    </G>
                  );
                })}
            {xLabels.map((point, index) => (
              <SvgText
                fill={colors.muted}
                fontSize={10}
                key={`${point.x}-${index}`}
                textAnchor={index === 0 ? 'start' : index === xLabels.length - 1 ? 'end' : 'middle'}
                x={xAt(point, allPoints.indexOf(point))}
                y={chartHeight - 8}
              >
                {formatX(point.x, chart.xAxis.scale)}
              </SvgText>
            ))}
          </Svg>
        ) : (
          <View style={{ height: chartHeight }} />
        )
      ) : (
        <View className="h-32 items-center justify-center rounded-2xl bg-canvas dark:bg-canvas-dark">
          <Text className="text-center text-sm text-muted dark:text-muted-dark">
            No data points are available for this chart.
          </Text>
        </View>
      )}
    </View>
  );
}
