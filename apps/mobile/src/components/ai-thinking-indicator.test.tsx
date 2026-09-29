import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiThinkingIndicator } from './ai-thinking-indicator';

const reduceMotion = vi.hoisted(() => ({ enabled: false }));
const loop = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));

vi.mock('react-native', () => {
  class Value {
    setValue = vi.fn();
    interpolate = () => 0;
  }
  return {
    View: 'View',
    Animated: { View: 'AnimatedView', Value, loop: () => loop, timing: () => ({}) },
    Easing: { inOut: () => undefined, sin: undefined },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(reduceMotion.enabled),
      addEventListener: () => ({ remove: vi.fn() }),
    },
  };
});
vi.mock('lucide-react-native', () => ({ Sparkles: 'Sparkles' }));

let renderer: ReactTestRenderer;
async function render() {
  await act(async () => {
    renderer = create(createElement(AiThinkingIndicator, { color: 'white' }));
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  loop.start.mockReset();
  loop.stop.mockReset();
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

describe('AI thinking indicator', () => {
  it('animates a sparkle with a halo and stays hidden from screen readers', async () => {
    reduceMotion.enabled = false;
    await render();
    expect(loop.start).toHaveBeenCalled();
    expect(renderer.root.findAllByType('AnimatedView' as never)).toHaveLength(2);
    expect(renderer.root.findByType('Sparkles' as never).props.color).toBe('white');
    expect(renderer.root.findByType('View' as never).props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
  });

  it('shows a static sparkle when reduce motion is enabled', async () => {
    reduceMotion.enabled = true;
    await render();
    expect(renderer.root.findAllByType('AnimatedView' as never)).toHaveLength(1);
    expect(loop.stop).toHaveBeenCalled();
  });
});
