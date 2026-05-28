import { NeuCard, useTheme } from '@app/ui';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReadingStats, useStreaks, useWeeklyStats } from '@/hooks/useStats';

export default function Stats() {
  const theme = useTheme();
  const weekly = useWeeklyStats();
  const streaks = useStreaks();
  const reading = useReadingStats();

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
          Stats
        </Text>

        <NeuCard style={{ marginBottom: theme.spacing[4] }}>
          <Text style={{ color: theme.colors.text.secondary, marginBottom: 4 }}>Current streak</Text>
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.font.display.size,
              fontWeight: '700',
            }}
          >
            {streaks.data?.currentStreak ?? 0}{' '}
            <Text style={{ fontSize: theme.font.body.size, color: theme.colors.text.secondary }}>
              days
            </Text>
          </Text>
          <Text style={{ color: theme.colors.text.secondary, marginTop: 4 }}>
            Best: {streaks.data?.longestStreak ?? 0} days
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
            Last 7 days
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {(weekly.data?.days ?? []).map((d) => (
              <View key={d.date} style={{ alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    backgroundColor:
                      d.percent === 0
                        ? theme.colors.bg.surfacePressed
                        : theme.colors.accent.success,
                    opacity: d.percent === 0 ? 1 : 0.3 + (d.percent / 100) * 0.7,
                  }}
                />
                <Text
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  {d.date.slice(5)}
                </Text>
              </View>
            ))}
          </View>
        </NeuCard>

        <NeuCard>
          <Text style={{ color: theme.colors.text.secondary, marginBottom: 4 }}>Reading</Text>
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.font.h2.size,
              fontWeight: theme.font.h2.weight,
            }}
          >
            {reading.data?.totalMinutes ?? 0} min
          </Text>
          <Text style={{ color: theme.colors.text.secondary, marginTop: 4 }}>this week</Text>
        </NeuCard>
      </ScrollView>
    </SafeAreaView>
  );
}
