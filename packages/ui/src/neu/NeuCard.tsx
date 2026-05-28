import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';
import { outerShadow } from './shadow.js';

export type NeuCardProps = ViewProps & {
  /** Border radius token. Default 'lg'. */
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'pill';
  /** Inset (pressed-looking) variant. Default false. */
  inset?: boolean;
  depth?: 'rest' | 'hover' | 'pressed';
};

export function NeuCard({
  radius = 'lg',
  inset = false,
  depth = 'rest',
  style,
  children,
  ...rest
}: NeuCardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: inset ? theme.colors.bg.surfacePressed : theme.colors.bg.surface,
    borderRadius: theme.radius[radius],
    padding: theme.spacing[4],
    ...(theme.name === 'high-contrast'
      ? { borderWidth: 2, borderColor: theme.colors.border.default }
      : outerShadow(theme, inset ? 'pressed' : depth)),
  };
  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}
