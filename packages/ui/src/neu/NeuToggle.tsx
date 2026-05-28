import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider.js';

export type NeuToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

const TRACK_W = 56;
const TRACK_H = 32;
const THUMB = 26;

export function NeuToggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: NeuToggleProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const offset = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    offset.value = reduced
      ? value
        ? 1
        : 0
      : withSpring(value ? 1 : 0, theme.motion.spring.snappy);
  }, [value, reduced, theme.motion.spring.snappy, offset]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * (TRACK_W - THUMB - 4) }],
  }));

  const track: ViewStyle = {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: value ? theme.colors.accent.primary : theme.colors.bg.surfacePressed,
    padding: 2,
    justifyContent: 'center',
    opacity: disabled ? 0.55 : 1,
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => !disabled && onValueChange(!value)}
      testID={testID}
      style={track}
    >
      <Animated.View
        style={[
          {
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: theme.colors.bg.surface,
          },
          thumbStyle,
        ]}
      />
      <View />
    </Pressable>
  );
}
