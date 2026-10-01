import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProgressChart } from './progress-chart';
import { chartLayout, chartTargets, normalizeChart } from './chart-layout';
import type { AnalysisChart } from '@fitness/ai';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'Circle',
  G: 'G',
  Line: 'Line',
  Path: 'Path',
  Rect: 'Rect',
  Text: 'SvgText',
}));
vi.mock('./theme-provider', () => ({
  useAppTheme: () => ({
    colors: { accent: 'gold', panel: 'black', text: 'white', muted: 'gray', line: 'gray' },
  }),
}));
const chart: AnalysisChart = {
  type: 'line',
  title: 'Load',
  xAxis: { label: 'Set', scale: 'category' },
  yAxis: { label: 'Weight', unit: 'kg' },
  series: [
    {
      name: 'Working sets',
      points: [
        { x: 'Deadlift S1', y: 80.12567 },
        { x: 'Deadlift S2', y: 95 },
      ],
    },
  ],
};
let renderer: ReactTestRenderer;
const find = (label: string) => renderer.root.findByProps({ accessibilityLabel: label });
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await act(() => {
    renderer = create(createElement(ProgressChart, { chart }));
  });
  await act(() =>
    renderer.root
      .findAllByType('View' as never)[0]
      .props.onLayout({ nativeEvent: { layout: { width: 320 } } }),
  );
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});
it('shows exact details after a chart tap, then lets users step through points', async () => {
  const targets = chartTargets(normalizeChart(chart), chartLayout(normalizeChart(chart), 320));
  await act(() =>
    renderer.root
      .findByProps({ testID: 'chart-touch-surface' })
      .props.onPress({ nativeEvent: { locationX: targets[0].x, locationY: targets[0].y } }),
  );
  const detail = () =>
    renderer.root
      .findByProps({ testID: 'chart-point-detail' })
      .findAllByType('Text' as never)
      .flatMap((node) => node.children)
      .join(' ');
  expect(detail()).toContain('Deadlift S1');
  expect(detail()).toContain('80.12567');
  expect(detail()).toContain('kg');
  expect(find('Previous data point').props.disabled).toBe(true);
  await act(() => find('Next data point').props.onPress());
  expect(detail()).toContain('Deadlift S2');
  expect(find('Next data point').props.disabled).toBe(true);
  await act(() => find('Previous data point').props.onPress());
  expect(detail()).toContain('Deadlift S1');
});
it('offers an accessible inspection entry and resets stale selection for a new chart', async () => {
  await act(() => find('Inspect chart data points').props.onPress());
  expect(renderer.root.findByProps({ testID: 'chart-point-detail' })).toBeDefined();
  await act(() =>
    renderer.update(createElement(ProgressChart, { chart: { ...chart, title: 'New graph' } })),
  );
  expect(renderer.root.findAllByProps({ testID: 'chart-point-detail' })).toHaveLength(0);
  expect(find('Inspect chart data points')).toBeDefined();
});

it('supports SVG web click coordinates', async () => {
  const targets = chartTargets(normalizeChart(chart), chartLayout(normalizeChart(chart), 320));
  await act(() =>
    renderer.root
      .findByProps({ testID: 'chart-touch-surface' })
      .props.onPress({ nativeEvent: { offsetX: targets[1].x, offsetY: targets[1].y } }),
  );
  expect(
    renderer.root
      .findByProps({ testID: 'chart-point-detail' })
      .findAllByType('Text' as never)
      .flatMap((node) => node.children)
      .join(' '),
  ).toContain('Deadlift S2');
});
