import { ThemeProvider } from '@app/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* idempotent */
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthed && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (isAuthed && inAuthGroup) {
      router.replace('/(tabs)/today');
    }
  }, [hydrated, isAuthed, segments, router]);

  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync().catch(() => {
        /* idempotent */
      });
    }
  }, [hydrated]);

  return <>{children}</>;
}

export default function RootLayout() {
  const themeName = useUIStore((s) => s.theme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider name={themeName}>
          <QueryClientProvider client={queryClient}>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </AuthGate>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
