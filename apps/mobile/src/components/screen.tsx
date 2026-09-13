import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeToggle } from './theme-toggle';
import { DisplayText } from './display-text';
import { useAppTheme } from './theme-provider';

export function Screen({
  children,
  headerActions,
  headerLeft,
}: PropsWithChildren<{ headerActions?: ReactNode; headerLeft?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      className="bg-canvas dark:bg-canvas-dark"
      style={{
        // NativeWind's flex-1 expands to flexGrow/flexBasis, which override the
        // flex: 0 that KeyboardAvoidingView needs to apply its Android height.
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View className="mx-auto w-full max-w-3xl flex-1">
        <View className="min-h-[72px] flex-row items-center justify-between px-5 py-3">
          {headerLeft ?? (
            <View accessibilityLabel="Fitness AI" accessible className="flex-row items-center">
              <DisplayText className="text-[32px] leading-10">fit</DisplayText>
              <View
                className="mx-1 h-5 w-1 bg-highlight"
                style={{ transform: [{ rotate: '18deg' }] }}
              />
              <DisplayText className="text-[32px] leading-10">ai</DisplayText>
            </View>
          )}
          <View className="flex-row items-center gap-1">
            {headerActions}
            <ThemeToggle />
          </View>
        </View>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}
