import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { appThemes } from '@fitness/ui';
import { ErrorNotice } from '@/components/error-notice';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAppTheme } from '@/components/theme-provider';

export function ThemeSettings() {
  const { colors, isDark, themeId, setTheme, storageError } = useAppTheme();
  return (
    <View className="mt-8">
      <Text className="text-lg font-semibold text-ink dark:text-ink-dark">Appearance</Text>
      <Text className="mt-1 text-sm leading-5 text-muted dark:text-muted-dark">
        Make it yours. Saved on this device.
      </Text>
      <View className="my-4 flex-row items-center justify-between gap-3">
        <Text className="text-base text-ink dark:text-ink-dark">
          {isDark ? 'Dark appearance' : 'Light appearance'}
        </Text>
        <ThemeToggle />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Color theme" className="gap-2">
        {appThemes.map((theme) => {
          const selected = theme.id === themeId;
          const preview = theme[isDark ? 'dark' : 'light'];
          return (
            <Pressable
              key={theme.id}
              accessibilityRole="radio"
              accessibilityLabel={theme.name}
              accessibilityHint="Apply this color theme and save it on this device"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => setTheme(theme.id)}
              className="min-h-20 flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-80"
              style={{
                backgroundColor: selected ? colors.soft : colors.panel,
                borderColor: selected ? colors.accent : colors.line,
              }}
            >
              <View
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                className="h-12 w-16 justify-center gap-1.5 rounded-xl border p-2"
                style={{ backgroundColor: preview.canvas, borderColor: preview.line }}
              >
                <View
                  className="h-1.5 w-7 rounded-full"
                  style={{ backgroundColor: preview.text }}
                />
                <View className="flex-row gap-1">
                  <View className="h-3 w-5 rounded" style={{ backgroundColor: preview.accent }} />
                  <View
                    className="h-3 w-5 rounded"
                    style={{ backgroundColor: preview.highlight }}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink dark:text-ink-dark">
                  {theme.name}
                </Text>
                <Text className="mt-0.5 text-xs leading-4 text-muted dark:text-muted-dark">
                  {theme.description}
                </Text>
              </View>
              <View className="h-6 w-6 items-center justify-center">
                {selected ? <Check size={20} color={colors.accent} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <ErrorNotice message={storageError} />
    </View>
  );
}
