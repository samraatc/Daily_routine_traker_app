import { Platform, type ViewStyle } from 'react-native';

import type { Theme } from '../theme/tokens.js';

/**
 * Computes the dual-shadow style for a Neumorphic surface.
 * React Native only supports a single `shadowColor` natively, so we render
 * the bottom-right (dark) shadow via the platform-native API and emulate
 * the top-left highlight by stacking a second `<View>` with negative offsets.
 * (Consumers wrap content in <NeuCard> which handles both layers.)
 *
 * This helper returns the bottom-right (primary) shadow.
 */
export function outerShadow(theme: Theme, depth: 'rest' | 'hover' | 'pressed' = 'rest'): ViewStyle {
  if (depth === 'pressed') {
    // Pressed state has no outer shadow.
    return Platform.OS === 'android'
      ? { elevation: 0 }
      : { shadowOpacity: 0 };
  }
  const e = depth === 'hover' ? theme.elevation.hover : theme.elevation.rest;
  if (Platform.OS === 'android') {
    return { elevation: e.offset };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: e.offset / 2, height: e.offset },
    shadowOpacity: theme.name === 'dark' ? 0.55 : 0.12,
    shadowRadius: e.blur / 2,
  };
}
