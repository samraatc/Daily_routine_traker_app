import { NeuButton, NeuCard, NeuInput, useTheme } from '@app/ui';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignIn } from '@/hooks/useAuthMutations';

export default function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState('alice@example.com');
  const [password, setPassword] = useState('password123');
  const signIn = useSignIn();

  const onSubmit = () => {
    signIn.mutate(
      { email, password },
      {
        onError: (err: any) => {
          Alert.alert('Sign in failed', err?.response?.data?.title ?? err.message);
        },
      },
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View style={{ flex: 1, padding: theme.spacing[5], justifyContent: 'center' }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.font.display.size,
            lineHeight: theme.font.display.lineHeight,
            fontWeight: theme.font.display.weight,
            marginBottom: theme.spacing[2],
          }}
        >
          Welcome back
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.font.body.size,
            lineHeight: theme.font.body.lineHeight,
            marginBottom: theme.spacing[6],
          }}
        >
          Pick up your routine where you left off.
        </Text>

        <NeuCard style={{ gap: theme.spacing[4], marginBottom: theme.spacing[5] }}>
          <View>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.font.caption.size,
                marginBottom: theme.spacing[2],
              }}
            >
              Email
            </Text>
            <NeuInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              accessibilityLabel="Email"
            />
          </View>
          <View>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.font.caption.size,
                marginBottom: theme.spacing[2],
              }}
            >
              Password
            </Text>
            <NeuInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              accessibilityLabel="Password"
            />
          </View>
        </NeuCard>

        <NeuButton
          label={signIn.isPending ? 'Signing in…' : 'Sign in'}
          onPress={onSubmit}
          fullWidth
          loading={signIn.isPending}
        />

        <View style={{ marginTop: theme.spacing[5], alignItems: 'center' }}>
          <Link href="/(auth)/sign-up" style={{ color: theme.colors.accent.primary }}>
            <Text style={{ color: theme.colors.accent.primary }}>Create an account</Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
