import { NeuButton, NeuCard, NeuInput, useTheme } from '@app/ui';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignUp } from '@/hooks/useAuthMutations';

export default function SignUp() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signUp = useSignUp();

  const onSubmit = () => {
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    signUp.mutate(
      { email, password, name, timezone: 'UTC' },
      {
        onError: (err: any) =>
          Alert.alert('Sign up failed', err?.response?.data?.title ?? err.message),
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
          Create your account
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.font.body.size,
            marginBottom: theme.spacing[6],
          }}
        >
          Two minutes from here to your first streak.
        </Text>

        <NeuCard style={{ gap: theme.spacing[4], marginBottom: theme.spacing[5] }}>
          <NeuInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            accessibilityLabel="Name"
          />
          <NeuInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            accessibilityLabel="Email"
          />
          <NeuInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Password (≥ 8 chars)"
            accessibilityLabel="Password"
          />
        </NeuCard>

        <NeuButton
          label={signUp.isPending ? 'Creating…' : 'Create account'}
          onPress={onSubmit}
          fullWidth
          loading={signUp.isPending}
        />

        <View style={{ marginTop: theme.spacing[5], alignItems: 'center' }}>
          <Link href="/(auth)/sign-in">
            <Text style={{ color: theme.colors.accent.primary }}>I already have an account</Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
