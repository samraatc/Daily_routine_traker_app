import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  type AccessibilityProps,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider.js';
import { outerShadow } from './shadow.js';

export type NeuButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type NeuButtonProps = Omit<PressableProps, 'style'> &
  AccessibilityProps & {
    label: string;
    onPress?: () => void;
    variant?: NeuButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
    testID?: string;
  };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NeuButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  accessibilityLabel,
  testID,
  ...rest
}: NeuButtonProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.value = reduced ? 1 : withSpring(1, theme.motion.spring.default);
  }, [pressed, reduced, theme.motion.spring.default]);

  const onPressOut = useCallback(() => {
    pressed.value = reduced ? 0 : withSpring(0, theme.motion.spring.default);
  }, [pressed, reduced, theme.motion.spring.default]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));

  const bg =
    variant === 'primary'
      ? theme.colors.accent.primary
      : variant === 'danger'
        ? theme.colors.accent.danger
        : theme.colors.bg.surface;

  const fg =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : disabled
        ? theme.colors.text.disabled
        : theme.colors.text.primary;

  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    opacity: disabled ? 0.55 : 1,
    ...(variant === 'ghost' || theme.name === 'high-contrast'
      ? variant === 'ghost'
        ? {}
        : { borderWidth: 2, borderColor: theme.colors.border.default }
      : outerShadow(theme, 'rest')),
  };

  if (fullWidth) base.alignSelf = 'stretch';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy: loading }}
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      hitSlop={8}
      style={[base, animatedStyle, style]}
      {...rest}
    >
      <Text
        style={{
          color: fg,
          fontSize: theme.font.bodyMedium.size,
          lineHeight: theme.font.bodyMedium.lineHeight,
          fontWeight: theme.font.bodyMedium.weight,
        }}
      >
        {loading ? '…' : label}
      </Text>
    </AnimatedPressable>
  );
}
