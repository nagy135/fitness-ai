import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useColorScheme } from 'nativewind';

export const themeColors = {
  light: {
    canvas: '#F5F7F2',
    panel: '#FFFFFF',
    text: '#172019',
    muted: '#69746D',
    line: '#DDE3DE',
    accent: '#65A30D',
  },
  dark: {
    canvas: '#0B0D0F',
    panel: '#14181B',
    text: '#F5F7F5',
    muted: '#84908A',
    line: '#29302C',
    accent: '#B9F34A',
  },
} as const;

const storageKey = 'fitness-ai-color-scheme';

type ThemeContextValue = {
  isDark: boolean;
  colors: (typeof themeColors)[keyof typeof themeColors];
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readStoredTheme() {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey);
  }
  return SecureStore.getItemAsync(storageKey);
}

async function saveTheme(theme: 'light' | 'dark') {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, theme);
    return;
  }
  await SecureStore.setItemAsync(storageKey, theme);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    let active = true;
    void readStoredTheme()
      .then((storedTheme) => {
        if (active && (storedTheme === 'light' || storedTheme === 'dark')) {
          setColorScheme(storedTheme);
        }
      })
      .catch(() => {
        // A theme preference is optional; keep following the system if storage fails.
      });
    return () => {
      active = false;
    };
  }, [setColorScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? themeColors.dark : themeColors.light,
      isDark,
      toggleTheme: () => {
        const nextTheme = isDark ? 'light' : 'dark';
        setColorScheme(nextTheme);
        void saveTheme(nextTheme).catch(() => {
          // The visual toggle should still work when persistence is unavailable.
        });
      },
    }),
    [isDark, setColorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useAppTheme must be used inside ThemeProvider');
  return theme;
}
