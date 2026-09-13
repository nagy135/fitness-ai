import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useColorScheme } from 'nativewind';
import {
  defaultThemeId,
  getTheme,
  isThemeId,
  ThemeColorsProvider,
  type ThemeColors,
  type ThemeId,
} from '@fitness/ui';

const modeStorageKey = 'fitness-ai-color-scheme';
const paletteStorageKey = 'fitness-ai-theme';

type ThemeContextValue = {
  isDark: boolean;
  colors: ThemeColors;
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  toggleTheme: () => void;
  storageError: string | undefined;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readPreference(key: string) {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function savePreference(key: string, value: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') throw new Error('Storage unavailable');
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [themeId, setThemeId] = useState<ThemeId>(defaultThemeId);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const pendingSave = useRef(Promise.resolve());
  const isDark = colorScheme === 'dark';
  const colors = getTheme(themeId)[isDark ? 'dark' : 'light'];

  const restorePreferences = useEffectEvent((mode: string | null, palette: string | null) => {
    if (mode === 'light' || mode === 'dark') setColorScheme(mode);
    if (isThemeId(palette)) setThemeId(palette);
    setReady(true);
  });

  // NativeWind returns a new setColorScheme function each render. Restoration
  // belongs to mounting only; rerunning it races pending preference writes and
  // briefly reapplies the previous palette after the user selects a new one.
  useEffect(() => {
    let active = true;
    void Promise.all([
      readPreference(modeStorageKey).catch(() => null),
      readPreference(paletteStorageKey).catch(() => null),
    ]).then(([mode, palette]) => {
      if (!active) return;
      restorePreferences(mode, palette);
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((key: string, value: string) => {
    // Serialize quick selections so an older write cannot win after a newer one.
    pendingSave.current = pendingSave.current
      .then(() => savePreference(key, value))
      .then(() => setStorageError(undefined))
      .catch(() =>
        setStorageError(
          'Appearance changed, but could not be saved on this device. Try selecting it again.',
        ),
      );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      isDark,
      themeId,
      storageError,
      setTheme: (id) => {
        setThemeId(id);
        persist(paletteStorageKey, id);
      },
      toggleTheme: () => {
        const mode = isDark ? 'light' : 'dark';
        setColorScheme(mode);
        persist(modeStorageKey, mode);
      },
    }),
    [colors, isDark, themeId, storageError, persist, setColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeColorsProvider colors={colors}>{ready ? children : null}</ThemeColorsProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useAppTheme must be used inside ThemeProvider');
  return theme;
}
