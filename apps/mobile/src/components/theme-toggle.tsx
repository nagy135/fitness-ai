import { Pressable, View } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useAppTheme } from './theme-provider';

export function ThemeToggle() {
  const { isDark, colors, toggleTheme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityHint="Switch between light and dark appearance"
      accessibilityState={{ checked: isDark }}
      onPress={toggleTheme}
      className="h-11 w-[76px] flex-row items-center rounded-full border border-line bg-panel p-1 active:opacity-80 dark:border-line-dark dark:bg-panel-dark"
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-full ${!isDark ? 'bg-accent' : ''}`}
      >
        <Sun size={17} color={!isDark ? colors.accentInk : colors.muted} strokeWidth={2} />
      </View>
      <View
        className={`h-8 w-8 items-center justify-center rounded-full ${isDark ? 'bg-accent-dark' : ''}`}
      >
        <Moon size={16} color={isDark ? colors.accentInk : colors.muted} strokeWidth={2} />
      </View>
    </Pressable>
  );
}
