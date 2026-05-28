import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider.js';

export type NeuRingProps = {
  /** 0..1 */
  progress: number;
  size?: number;
  thickness?: number;
  label?: string;
  caption?: string;
};

/**
 * Circular Neumorphic progress ring.
 * Implemented with two stacked rotated half-circles — sufficient for our
 * 0..100% domain without pulling in react-native-svg.
 */
export function NeuRing({
  progress,
  size = 180,
  thickness = 16,
  label,
  caption,
}: NeuRingProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? progress : 0);

  useEffect(() => {
    p.value = reduced ? progress : withSpring(progress, theme.motion.spring.gentle);
  }, [progress, reduced, theme.motion.spring.gentle, p]);

  const right = useAnimatedStyle(() => {
    // First 50% sweep.
    const v = Math.min(p.value, 0.5);
    return { transform: [{ rotate: `${v * 360}deg` }] };
  });
  const left = useAnimatedStyle(() => {
    const v = Math.max(p.value - 0.5, 0);
    return { transform: [{ rotate: `${v * 360}deg` }] };
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.bg.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole="image"
      accessibilityLabel={label ? `${label}: ${Math.round(progress * 100)}%` : undefined}
    >
      {/* Track */}
      <View
        style={{
          position: 'absolute',
          width: size - thickness * 2,
          height: size - thickness * 2,
          borderRadius: (size - thickness * 2) / 2,
          backgroundColor: theme.colors.bg.base,
        }}
      />
      {/* Progress arcs */}
      <View
        style={{ position: 'absolute', width: size, height: size, overflow: 'hidden' }}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: theme.colors.accent.success,
              borderWidth: thickness,
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
            },
            right,
          ]}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: theme.colors.accent.success,
              borderWidth: thickness,
              borderTopColor: 'transparent',
              borderLeftColor: 'transparent',
            },
            left,
          ]}
        />
      </View>
      {/* Labels */}
      <View style={{ alignItems: 'center' }}>
        {label && (
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.font.display.size,
              lineHeight: theme.font.display.lineHeight,
              fontWeight: theme.font.display.weight,
            }}
          >
            {label}
          </Text>
        )}
        {caption && (
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: theme.font.caption.size,
              lineHeight: theme.font.caption.lineHeight,
              marginTop: 4,
            }}
          >
            {caption}
          </Text>
        )}
      </View>
    </View>
  );
}
