import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useAppTheme } from './theme-provider';

/** A small equipment illustration; decorative, never a chart of training data. */
export function WeightPlates({ size = 112 }: { size?: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <G transform="rotate(-25 60 60)">
          <Rect x="11" y="54" width="100" height="12" rx="5" fill={colors.highlightInk} />
          <Rect x="25" y="23" width="22" height="74" rx="11" fill={colors.highlightInk} />
          <Rect
            x="34"
            y="15"
            width="24"
            height="90"
            rx="12"
            fill={colors.soft}
            stroke={colors.highlight}
            strokeWidth="2"
          />
          <Path
            d="M44 30 V47 M44 73 V90"
            stroke={colors.muted}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Rect x="74" y="29" width="16" height="62" rx="8" fill={colors.highlightInk} />
          <Rect
            x="65"
            y="20"
            width="20"
            height="80"
            rx="10"
            fill={colors.soft}
            stroke={colors.highlight}
            strokeWidth="2"
          />
          <Circle cx="75" cy="60" r="5" fill={colors.highlight} />
        </G>
      </Svg>
    </View>
  );
}
