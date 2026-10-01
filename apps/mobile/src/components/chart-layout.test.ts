import { describe, expect, it } from 'vitest';
import {
  chartLayout,
  chartTargets,
  nearestChartTarget,
  formatExactValue,
  formatPointX,
  formatX,
  normalizeChart,
  padding,
  type NormalizedChart,
} from './chart-layout';

const chart = (
  scale: NormalizedChart['xAxis']['scale'],
  xs: (string | number)[],
): NormalizedChart => ({
  type: 'bar',
  title: 'Volume',
  xAxis: { label: 'Week', scale },
  yAxis: { label: 'Volume' },
  series: [{ name: 'Volume', points: xs.map((x, i) => ({ x, y: (i + 1) * 5350 })) }],
});

describe('mobile chart geometry', () => {
  it.each([
    chart('category', ['2026-09-07', '2026-09-21']),
    chart('time', ['2026-09-07', '2026-09-21']),
    chart('linear', [1, 2, 100]),
    chart('time', ['2026-09-07']),
  ])('keeps complete bar groups inside the plot at phone widths', (input) => {
    input.series.push({ ...input.series[0], name: 'Second' });
    const layout = chartLayout(input, 320);
    for (const point of layout.allPoints) {
      expect(layout.xAt(point) - layout.groupWidth / 2).toBeGreaterThanOrEqual(padding.left);
      expect(layout.xAt(point) + layout.groupWidth / 2).toBeLessThanOrEqual(
        layout.canvasWidth - padding.right,
      );
    }
  });
  it('labels every set with room for full exercise names on a scrolling category axis', () => {
    const names = Array.from({ length: 20 }, (_, i) => `Seated Cable Row S${i + 1}`);
    const input = chart('category', names);
    input.type = 'line';
    const layout = chartLayout(input, 320);
    expect(layout.canvasWidth).toBeGreaterThan(320);
    expect(layout.xLabels.map((point) => point.x)).toEqual(names);
    const halfLabelWidth = Math.max(...names.map((name) => (name.length * 6.5) / 2));
    for (let index = 0; index < names.length; index++) {
      const x = layout.xAt(layout.xLabels[index]);
      expect(x - halfLabelWidth).toBeGreaterThanOrEqual(padding.left);
      expect(x + halfLabelWidth).toBeLessThanOrEqual(layout.canvasWidth - padding.right);
      if (index)
        expect(x - layout.xAt(layout.xLabels[index - 1])).toBeGreaterThan(halfLabelWidth * 2);
      expect(formatX(names[index], 'category')).toBe(names[index]);
    }
  });
  it('keeps continuous charts fitted to the viewport', () => {
    const layout = chartLayout(
      chart(
        'linear',
        Array.from({ length: 20 }, (_, i) => i),
      ),
      320,
    );
    expect(layout.canvasWidth).toBe(320);
    expect(layout.xLabels.length).toBeLessThan(20);
  });
  it('sorts time series and drops invalid dates instead of plotting them as index values', () => {
    const input = chart('time', ['2026-09-21', 'invalid', '2026-09-07']);
    expect(normalizeChart(input).series[0].points.map((p) => p.x)).toEqual([
      '2026-09-07',
      '2026-09-21',
    ]);
  });
  it('uses a shared chronological axis for disjoint series', () => {
    const input = chart('time', ['2026-09-21', '2026-09-07']);
    input.series.push({ name: 'Other', points: [{ x: '2026-09-14', y: 3 }] });
    const layout = chartLayout(normalizeChart(input), 400);
    expect(layout.xLabels.map((p) => p.x)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21']);
  });
  it('handles negative and all-zero bars with finite coordinates', () => {
    for (const values of [
      [0, 0],
      [-20, -10],
      [-10, 20],
    ]) {
      const input = chart('category', ['A', 'B']);
      input.series[0].points.forEach((p, i) => {
        p.y = values[i];
      });
      const layout = chartLayout(input, 320);
      expect(Number.isFinite(layout.yAt(0))).toBe(true);
      for (const value of values) expect(Number.isFinite(layout.yAt(value))).toBe(true);
    }
  });
});

describe('chart point inspection', () => {
  it('selects the nearest point within a generous tap radius', () => {
    const input = chart('category', ['Deadlift S1', 'Deadlift S2']);
    input.type = 'line';
    const targets = chartTargets(input, chartLayout(input, 320));
    expect(nearestChartTarget(targets, targets[1].x + 18, targets[1].y + 8)).toBe(1);
    expect(nearestChartTarget(targets, -100, -100)).toBe(-1);
  });
  it('selects the correct series by tapping anywhere inside its bar, including negative bars', () => {
    const input = chart('category', ['Set 1']);
    input.series[0].points[0].y = 10;
    input.series.push({ name: 'Second', points: [{ x: 'Set 1', y: -20 }] });
    const targets = chartTargets(input, chartLayout(input, 320));
    targets.forEach((target, index) => {
      expect(nearestChartTarget(targets, target.x, (target.top + target.bottom) / 2)).toBe(index);
    });
  });
  it('keeps zero bars selectable and includes points beyond the first scroll viewport', () => {
    const input = chart(
      'category',
      Array.from({ length: 20 }, (_, i) => `Set ${i}`),
    );
    input.series[0].points.at(-1)!.y = 0;
    const targets = chartTargets(input, chartLayout(input, 320));
    const last = targets.at(-1)!;
    expect(last.x).toBeGreaterThan(320);
    expect(nearestChartTarget(targets, last.x, last.y - 10)).toBe(19);
  });
  it('preserves small decimal values and the complete date/time in details', () => {
    expect(formatExactValue(1.23456789)).toBe(
      (1.23456789).toLocaleString(undefined, { maximumSignificantDigits: 21 }),
    );
    expect(formatExactValue(0.000123456)).not.toBe('0');
    expect(formatPointX('2026-09-23T12:34:00Z', 'time')).toBe('2026-09-23 12:34:00.000 UTC');
    expect(formatPointX('2026-09-23', 'time')).toBe('2026-09-23');
  });
});
