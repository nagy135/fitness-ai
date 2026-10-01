import type { AnalysisChart } from '@fitness/ai';

export type ChartPoint = { x: string | number; y: number };
export type NormalizedChart = {
  type: 'line' | 'bar' | 'scatter';
  title: string;
  xAxis: { label: string; scale: 'category' | 'linear' | 'time' };
  yAxis: { label: string; unit?: string };
  series: { name: string; points: ChartPoint[] }[];
};

export const chartHeight = 230;
export const padding = { bottom: 40, left: 52, right: 16, top: 18 };

function numericX(point: ChartPoint, scale: NormalizedChart['xAxis']['scale']) {
  return scale === 'time' && typeof point.x === 'string' ? Date.parse(point.x) : Number(point.x);
}

export function normalizeChart(raw: AnalysisChart): NormalizedChart {
  const chart: NormalizedChart =
    'series' in raw
      ? raw
      : {
          type: 'line',
          title: raw.title,
          xAxis: { label: 'Date', scale: 'time' },
          yAxis: { label: raw.metric, unit: raw.unit },
          series: [{ name: raw.metric, points: raw.points }],
        };
  return {
    ...chart,
    series: chart.series.map((series) => ({
      ...series,
      points: series.points
        .filter(
          (point) =>
            Number.isFinite(point.y) &&
            (chart.xAxis.scale === 'category' ||
              Number.isFinite(numericX(point, chart.xAxis.scale))),
        )
        .sort((a, b) =>
          chart.xAxis.scale === 'category'
            ? 0
            : numericX(a, chart.xAxis.scale) - numericX(b, chart.xAxis.scale),
        ),
    })),
  };
}

export function formatValue(value: number) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}m`;
  if (magnitude >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return String(Number(value.toPrecision(3)));
}

export function formatX(value: string | number, scale: NormalizedChart['xAxis']['scale']) {
  if (scale === 'time') {
    const timestamp = typeof value === 'number' ? value : Date.parse(value);
    if (Number.isFinite(timestamp))
      return new Date(timestamp).toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
  }
  if (scale === 'category') return String(value);
  const label = String(value);
  return label.length > 14 ? `${label.slice(0, 12)}…` : label;
}

export function chartLayout(chart: NormalizedChart, width: number) {
  const allPoints = chart.series.flatMap((series) => series.points);
  const values = allPoints.map((point) => point.y);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 0;
  const spread = rawMax - rawMin;
  const yPadding = spread > 0 ? spread * 0.12 : Math.max(Math.abs(rawMax) * 0.1, 1);
  const minY = chart.type === 'bar' ? Math.min(0, rawMin) : rawMin - yPadding;
  const maxY = chart.type === 'bar' ? Math.max(0, rawMax) || 1 : rawMax + yPadding;
  const categories = [...new Set(allPoints.map((point) => String(point.x)))];
  // Give every category its own readable slot, including the edge labels.
  // Continuous axes keep their compact overview and sampled ticks.
  const categorySlotWidth = Math.max(80, ...categories.map((label) => label.length * 6.5 + 24));
  const canvasWidth =
    chart.xAxis.scale === 'category'
      ? Math.max(width, padding.left + padding.right + categories.length * categorySlotWidth)
      : width;
  const plotWidth = Math.max(0, canvasWidth - padding.left - padding.right);
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const xValues = [
    ...new Set(
      allPoints.map((point) =>
        chart.xAxis.scale === 'category'
          ? categories.indexOf(String(point.x))
          : numericX(point, chart.xAxis.scale),
      ),
    ),
  ].sort((a, b) => a - b);
  const minX = xValues[0] ?? 0;
  const maxX = xValues.at(-1) ?? 0;
  const minGap =
    xValues.length > 1
      ? Math.min(...xValues.slice(1).map((value, index) => value - xValues[index]))
      : 1;
  // Reserve half a slot at each end, including on continuous axes. Entire bar
  // groups remain inside the plot, even with irregular dates or many series.
  const inset = chart.type === 'bar' || chart.xAxis.scale === 'category' ? minGap / 2 : 0;
  const domain = maxX - minX + inset * 2;
  const slotWidth = domain ? (plotWidth * minGap) / domain : plotWidth;
  const groupWidth = Math.min(slotWidth * 0.72, 48);
  const barWidth = groupWidth / chart.series.length;
  const xAt = (point: ChartPoint) => {
    const value =
      chart.xAxis.scale === 'category'
        ? categories.indexOf(String(point.x))
        : numericX(point, chart.xAxis.scale);
    return padding.left + (domain ? ((value - minX + inset) / domain) * plotWidth : plotWidth / 2);
  };
  const yAt = (value: number) => padding.top + ((maxY - value) / (maxY - minY)) * plotHeight;
  const uniquePoints = [...new Map(allPoints.map((point) => [xAt(point), point])).values()].sort(
    (a, b) => xAt(a) - xAt(b),
  );
  const labelCount = Math.max(2, Math.min(4, Math.floor(plotWidth / 90)));
  const xLabels = uniquePoints.filter(
    (_, index) =>
      chart.xAxis.scale === 'category' ||
      uniquePoints.length <= labelCount ||
      Array.from({ length: labelCount }, (_, i) =>
        Math.round((i * (uniquePoints.length - 1)) / (labelCount - 1)),
      ).includes(index),
  );
  return {
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
  };
}

export function formatExactValue(value: number) {
  return value.toLocaleString(undefined, { maximumSignificantDigits: 21 });
}

export function formatPointX(value: string | number, scale: NormalizedChart['xAxis']['scale']) {
  if (scale !== 'time') return String(value);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  const iso = date.toISOString();
  return iso.endsWith('T00:00:00.000Z')
    ? iso.slice(0, 10)
    : iso.replace('T', ' ').replace('Z', ' UTC');
}

export function chartTargets(chart: NormalizedChart, layout: ReturnType<typeof chartLayout>) {
  return chart.series.flatMap((series, seriesIndex) =>
    series.points.map((point) => {
      const x = layout.xAt(point);
      const y = layout.yAt(point.y);
      const barX =
        x - layout.groupWidth / 2 + seriesIndex * layout.barWidth + layout.barWidth * 0.075;
      const isBar = chart.type === 'bar';
      return {
        point,
        seriesName: series.name,
        seriesIndex,
        x: isBar ? barX + (layout.barWidth * 0.85) / 2 : x,
        y,
        left: isBar ? barX : x,
        right: isBar ? barX + layout.barWidth * 0.85 : x,
        top: isBar ? Math.min(y, layout.yAt(0)) : y,
        bottom: isBar ? Math.max(y, layout.yAt(0)) : y,
      };
    }),
  );
}

// Measure distance to the actual bar or point, so taps near a small mark work
// without overlapping invisible hit boxes stealing taps from nearby series.
export function nearestChartTarget(targets: ReturnType<typeof chartTargets>, x: number, y: number) {
  let selected = -1;
  let bestDistance = 28 * 28;
  targets.forEach((target, index) => {
    const dx = Math.max(target.left - x, 0, x - target.right);
    const dy = Math.max(target.top - y, 0, y - target.bottom);
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      selected = index;
    }
  });
  return selected;
}
