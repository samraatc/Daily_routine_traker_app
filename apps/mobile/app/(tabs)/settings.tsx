import { NeuButton, NeuCard, NeuToggle, useTheme } from '@app/ui';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

export default function Settings() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const themeName = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing[5] }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.font.h1.size,
            lineHeight: theme.font.h1.lineHeight,
            fontWeight: theme.font.h1.weight,
            marginBottom: theme.spacing[5],
          }}
        >
          Settings
        </Text>

        <NeuCard style={{ marginBottom: theme.spacing[4] }}>
          <Text style={{ color: theme.colors.text.secondary, marginBottom: 4 }}>Signed in as</Text>
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.font.bodyMedium.size,
              fontWeight: theme.font.bodyMedium.weight,
            }}
          >
            {user?.email ?? '—'}
          </Text>
          <Text style={{ color: theme.colors.text.secondary, marginTop: 4 }}>
            Role: {user?.role ?? 'user'}
          </Text>
        </NeuCard>

        <NeuCard style={{ marginBottom: theme.spacing[4] }}>
          <Text
            style={{
              color: theme.colors.text.primary,
              fontWeight: '600',
              marginBottom: theme.spacing[3],
            }}
          >
            Appearance
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.colors.text.primary }}>Dark mode</Text>
            <NeuToggle
              value={themeName === 'dark'}
              onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
              accessibilityLabel="Toggle dark mode"
            />
          </View>
          <View style={{ height: theme.spacing[3] }} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.colors.text.primary }}>High contrast</Text>
            <NeuToggle
              value={themeName === 'high-contrast'}
              onValueChange={(v) => setTheme(v ? 'high-contrast' : 'light')}
              accessibilityLabel="Toggle high contrast"
            />
          </View>
        </NeuCard>

        <NeuButton variant="danger" label="Sign out" onPress={signOut} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}
