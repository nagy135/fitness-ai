import { Moon, Sun } from 'lucide-react-native';
import { IconButton } from '@fitness/ui';
import { useAppTheme } from './theme-provider';

export function ThemeToggle() {
  const { isDark, colors, toggleTheme } = useAppTheme();
  const Icon = isDark ? Sun : Moon;
  return (
    <IconButton
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={toggleTheme}
    >
      <Icon size={20} color={colors.text} strokeWidth={2} />
    </IconButton>
  );
}
