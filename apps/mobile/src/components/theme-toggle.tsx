import { Pressable, StyleSheet } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useAppTheme } from './theme-provider';

export function ThemeToggle() {
  const { isDark, colors, toggleTheme } = useAppTheme();
  const Icon = isDark ? Sun : Moon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={toggleTheme}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.panel,
          borderColor: colors.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon size={20} color={colors.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
