import { AppState } from 'react-native';

export function waitForForeground(): Promise<boolean> {
  if (AppState.currentState === 'active') return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (active: boolean) => {
      clearTimeout(timer);
      subscription.remove();
      resolve(active);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') finish(true);
    });
    const timer = setTimeout(() => finish(false), 3_000);
    if (AppState.currentState === 'active') finish(true);
  });
}
