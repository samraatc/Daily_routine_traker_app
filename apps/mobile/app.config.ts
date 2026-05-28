import { type ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Daily Routine & E-Book Tracker',
  slug: 'daily-routine-tracker',
  scheme: 'drt',
  version: '2.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.elskov.dailyroutine',
    supportsTablet: true,
  },
  android: {
    package: 'com.elskov.dailyroutine',
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-font'],
  experiments: { typedRoutes: true },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  },
};

export default config;
