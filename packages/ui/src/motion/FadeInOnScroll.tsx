import React, { useEffect } from 'react';
import { type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider.js';

export type FadeInOnScrollProps = ViewProps & {
  delay?: number;
  enabled?: boolean;
  /** Vertical translation distance in dp. Default 24. */
  distance?: number;
};

/**
 * Fades + slides a section in once it's mounted (proxy for "entered viewport"
 * in our screen-at-a-time layouts). Respects reduced motion.
 */
export function FadeInOnScroll({
  delay = 0,
  enabled = true,
  distance = 24,
  style,
  children,
  ...rest
}: FadeInOnScrollProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced || !enabled ? 1 : 0);
  const translateY = useSharedValue(reduced || !enabled ? 0 : distance);

  useEffect(() => {
    if (reduced || !enabled) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    const spring = theme.motion.spring.gentle;
    const timer = setTimeout(() => {
      opacity.value = withSpring(1, spring);
      translateY.value = withSpring(0, spring);
    }, delay);
    return () => clearTimeout(timer);
  }, [reduced, enabled, delay, opacity, translateY, theme.motion.spring.gentle]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animated, style]} {...rest}>
      {children}
    </Animated.View>
  );
}
