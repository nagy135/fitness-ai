import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { AnalysisChart } from '@fitness/ai';
import { useAppTheme } from './theme-provider';

import {
  chartHeight,
  padding,
  normalizeChart,
  chartLayout,
  formatValue,
  formatX,
  formatExactValue,
  formatPointX,
  chartTargets,
  nearestChartTarget,
} from './chart-layout';

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
  const [showData, setShowData] = useState(false);
  const plotScroll = useRef<ScrollView>(null);
  const [selection, setSelection] = useState<{ chart: AnalysisChart; index: number }>();
  const layout = chartLayout(chart, width);
  const {
    canvasWidth,
    allPoints,
    minY,
    maxY,
    plotHeight,
    groupWidth,
    barWidth,
    xAt,
    yAt,
    xLabels,
  } = layout;
  const targets = chartTargets(chart, layout);
  const selectedIndex = selection?.chart === rawChart ? selection.index : -1;
  const selected = targets[selectedIndex];
  const selectPoint = (index: number, reveal = false) => {
    if (!targets[index]) return;
    setSelection({ chart: rawChart, index });
    if (reveal)
      plotScroll.current?.scrollTo({
        x: Math.max(0, Math.min(canvasWidth - width, targets[index].x - width / 2)),
        animated: true,
      });
  };
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

  return (
    <View
      accessibilityLabel={`${chart.title}, ${chart.type} chart with ${chart.series.length} series and ${allPoints.length} data points`}
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
          <ScrollView
            ref={plotScroll}
            horizontal
            nestedScrollEnabled
            accessibilityLabel={`${chart.title} plot`}
            accessibilityHint={
              canvasWidth > width ? 'Swipe horizontally to see every set label.' : undefined
            }
            showsHorizontalScrollIndicator={canvasWidth > width}
            style={{ flexGrow: 0 }}
          >
            <Svg height={chartHeight} width={canvasWidth}>
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
                      x2={canvasWidth - padding.right}
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
                    return series.points.map((point, pointIndex) => {
                      const center = xAt(point);
                      const valueY = yAt(point.y);
                      const zeroY = yAt(0);
                      return (
                        <Rect
                          fill={palette[seriesIndex]}
                          height={Math.abs(zeroY - valueY)}
                          key={`${series.name}-${point.x}-${pointIndex}`}
                          rx={2}
                          width={barWidth * 0.85}
                          x={center - groupWidth / 2 + seriesIndex * barWidth + barWidth * 0.075}
                          y={Math.min(valueY, zeroY)}
                        />
                      );
                    });
                  })
                : chart.series.map((series, seriesIndex) => {
                    const path = series.points
                      .map(
                        (point, pointIndex) =>
                          `${pointIndex ? 'L' : 'M'} ${xAt(point)} ${yAt(point.y)}`,
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
                          chart.type === 'scatter' ||
                          chart.xAxis.scale === 'category' ||
                          pointIndex % pointStride === 0 ||
                          pointIndex === series.points.length - 1 ? (
                            <Circle
                              cx={xAt(point)}
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
              {selected ? (
                chart.type === 'bar' ? (
                  <Rect
                    pointerEvents="none"
                    x={selected.left - 2}
                    y={selected.top - 2}
                    width={selected.right - selected.left + 4}
                    height={Math.max(4, selected.bottom - selected.top + 4)}
                    fill="none"
                    stroke={colors.text}
                    strokeWidth={2}
                    rx={3}
                  />
                ) : (
                  <Circle
                    pointerEvents="none"
                    cx={selected.x}
                    cy={selected.y}
                    r={7}
                    fill={palette[selected.seriesIndex]}
                    stroke={colors.text}
                    strokeWidth={2}
                  />
                )
              ) : null}
              {xLabels.map((point, index) => (
                <SvgText
                  fill={colors.muted}
                  fontSize={10}
                  key={`${point.x}-${index}`}
                  textAnchor="middle"
                  x={Math.max(
                    padding.left + 20,
                    Math.min(canvasWidth - padding.right - 20, xAt(point)),
                  )}
                  y={chartHeight - 8}
                >
                  {formatX(point.x, chart.xAxis.scale)}
                </SvgText>
              ))}
              <Rect
                testID="chart-touch-surface"
                x={0}
                y={0}
                width={canvasWidth}
                height={chartHeight}
                fill="transparent"
                onPress={(event) => {
                  // SVG web clicks expose offsets; native presses expose location coordinates.
                  const press = event.nativeEvent as typeof event.nativeEvent & {
                    offsetX?: number;
                    offsetY?: number;
                  };
                  const index = nearestChartTarget(
                    targets,
                    press.locationX ?? press.offsetX ?? NaN,
                    press.locationY ?? press.offsetY ?? NaN,
                  );
                  if (index >= 0) selectPoint(index);
                }}
              />
            </Svg>
          </ScrollView>
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
      {width > 0 && canvasWidth > width && allPoints.length > 0 ? (
        <Text className="mt-1 text-xs text-muted dark:text-muted-dark">
          Swipe sideways to see every set →
        </Text>
      ) : null}
      {allPoints.length > 0 ? (
        <View className="mt-2 rounded-xl bg-soft p-3 dark:bg-soft-dark">
          {selected ? (
            <>
              <View accessibilityLiveRegion="polite" testID="chart-point-detail">
                <Text className="text-sm font-bold text-ink dark:text-ink-dark">
                  {formatPointX(selected.point.x, chart.xAxis.scale)}
                </Text>
                <Text className="mt-1 text-xs text-muted dark:text-muted-dark">
                  {selected.seriesName} · {chart.yAxis.label}
                </Text>
                <Text selectable className="mt-1 text-lg font-bold text-ink dark:text-ink-dark">
                  {formatExactValue(selected.point.y)}
                  {chart.yAxis.unit ? ` ${chart.yAxis.unit}` : ''}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous data point"
                  disabled={selectedIndex === 0}
                  accessibilityState={{ disabled: selectedIndex === 0 }}
                  onPress={() => selectPoint(selectedIndex - 1, true)}
                  className="min-h-11 min-w-11 justify-center"
                  style={{ opacity: selectedIndex === 0 ? 0.4 : 1 }}
                >
                  <Text className="font-bold text-accent dark:text-accent-dark">← Previous</Text>
                </Pressable>
                <Text className="text-xs text-muted dark:text-muted-dark">
                  {selectedIndex + 1} / {targets.length}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next data point"
                  disabled={selectedIndex === targets.length - 1}
                  accessibilityState={{ disabled: selectedIndex === targets.length - 1 }}
                  onPress={() => selectPoint(selectedIndex + 1, true)}
                  className="min-h-11 min-w-11 justify-center"
                  style={{ opacity: selectedIndex === targets.length - 1 ? 0.4 : 1 }}
                >
                  <Text className="font-bold text-accent dark:text-accent-dark">Next →</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Inspect chart data points"
              onPress={() => selectPoint(0, true)}
              className="min-h-11 justify-center"
            >
              <Text className="text-sm text-muted dark:text-muted-dark">
                Tap a point or bar to see its exact value.
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {allPoints.length > 0 && !compact ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showData }}
            onPress={() => setShowData((previous) => !previous)}
            className="min-h-11 justify-center"
          >
            <Text className="text-sm font-bold text-accent dark:text-accent-dark">
              {showData ? 'Hide values' : 'Show values'}
            </Text>
          </Pressable>
          {showData
            ? chart.series.map((series, seriesIndex) => (
                <View key={seriesIndex} className="mb-3">
                  <Text className="font-bold text-ink dark:text-ink-dark">{series.name}</Text>
                  {series.points.map((point, index) => (
                    <View
                      key={index}
                      className="flex-row justify-between gap-3 border-b border-line py-2 dark:border-line-dark"
                    >
                      <Text className="flex-1 text-sm text-muted dark:text-muted-dark">
                        {formatPointX(point.x, chart.xAxis.scale)}
                      </Text>
                      <Text selectable className="text-sm text-ink dark:text-ink-dark">
                        {formatExactValue(point.y)} {chart.yAxis.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}
