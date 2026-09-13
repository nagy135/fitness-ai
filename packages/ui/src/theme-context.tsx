import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useColorScheme, vars } from 'nativewind';
import defaultColors from './theme.json';
import { themeVariables, type ThemeColors } from './themes';

const ThemeColorsContext = createContext<ThemeColors | null>(null);

export function ThemeColorsProvider({
  colors,
  children,
}: PropsWithChildren<{ colors: ThemeColors }>) {
  const variables = useMemo(() => vars(themeVariables(colors)), [colors]);
  return (
    <ThemeColorsContext.Provider value={colors}>
      <View style={[variables, { flex: 1, backgroundColor: colors.canvas }]}>{children}</View>
    </ThemeColorsContext.Provider>
  );
}

export function useThemeColors(): ThemeColors {
  const colors = useContext(ThemeColorsContext);
  const { colorScheme } = useColorScheme();
  return colors ?? defaultColors[colorScheme === 'dark' ? 'dark' : 'light'];
}

// Web modals are portaled outside the root View's CSS variable scope.
export function useThemeVariables() {
  const colors = useThemeColors();
  return useMemo(() => vars(themeVariables(colors)), [colors]);
}
