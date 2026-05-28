import { NeuCard, useTheme } from '@app/ui';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Library() {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View style={{ flex: 1, padding: theme.spacing[5] }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.font.h1.size,
            lineHeight: theme.font.h1.lineHeight,
            fontWeight: theme.font.h1.weight,
            marginBottom: theme.spacing[5],
          }}
        >
          Library
        </Text>
        <NeuCard>
          <Text style={{ color: theme.colors.text.secondary }}>
            Your books will live here. Upload + reader land in Phase 5 of the roadmap.
          </Text>
        </NeuCard>
      </View>
    </SafeAreaView>
  );
}
