import { useTheme } from '@app/ui';
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: focused ? theme.colors.accent.primary : theme.colors.text.secondary,
        fontSize: 11,
        fontWeight: focused ? '600' : '500',
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Today" focused={focused} /> }}
      />
      <Tabs.Screen
        name="library"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Library" focused={focused} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Stats" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} /> }}
      />
    </Tabs>
  );
}
