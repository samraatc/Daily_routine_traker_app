import React from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider.js';

export type NeuInputProps = TextInputProps & {
  invalid?: boolean;
};

/** Inset (well-shaped) text input. */
export function NeuInput({ invalid = false, style, ...rest }: NeuInputProps) {
  const theme = useTheme();
  const container: ViewStyle = {
    backgroundColor: theme.colors.bg.surfacePressed,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    minHeight: 48,
    justifyContent: 'center',
    ...(theme.name === 'high-contrast' || invalid
      ? {
          borderWidth: 2,
          borderColor: invalid ? theme.colors.accent.danger : theme.colors.border.default,
        }
      : {}),
  };
  return (
    <View style={container}>
      <TextInput
        placeholderTextColor={theme.colors.text.disabled}
        style={[
          {
            color: theme.colors.text.primary,
            fontSize: theme.font.body.size,
            lineHeight: theme.font.body.lineHeight,
            padding: 0,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
