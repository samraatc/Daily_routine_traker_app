import { NeuButton, NeuRing, StaggerList, useTheme } from '@app/ui';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TaskCard } from '@/components/TaskCard';
import { useCompletions, useMarkDone, useUndoCompletion } from '@/hooks/useCompletions';
import { useStreaks } from '@/hooks/useStats';
import { useTasksList } from '@/hooks/useTasks';

function dayOfWeek(date: Date) {
  return date.getDay(); // 0=Sun..6=Sat
}

export default function Today() {
  const theme = useTheme();
  const today = useMemo(() => new Date(), []);
  const todayStr = today.toISOString().slice(0, 10);

  const tasksQ = useTasksList();
  const completionsQ = useCompletions(todayStr, todayStr);
  const streakQ = useStreaks();
  const markDone = useMarkDone();
  const undoDone = useUndoCompletion();

  const dow = dayOfWeek(today);
  const todaysTasks = (tasksQ.data ?? []).filter((t) => t.repeatDays.includes(dow));

  const completionByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of completionsQ.data ?? []) {
      if (c.completedAt === todayStr) map.set(c.taskId, c.id);
    }
    return map;
  }, [completionsQ.data, todayStr]);

  const done = todaysTasks.filter((t) => completionByTaskId.has(t.id)).length;
  const total = todaysTasks.length;
  const progress = total === 0 ? 0 : done / total;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing[5] }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.font.h1.size,
            lineHeight: theme.font.h1.lineHeight,
            fontWeight: theme.font.h1.weight,
            marginBottom: theme.spacing[2],
          }}
        >
          Today
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.font.body.size,
            marginBottom: theme.spacing[5],
          }}
        >
          {today.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        <View style={{ alignItems: 'center', marginBottom: theme.spacing[6] }}>
          <NeuRing
            progress={progress}
            label={`${Math.round(progress * 100)}%`}
            caption={`${done} of ${total} done`}
          />
        </View>

        {streakQ.data && streakQ.data.currentStreak > 0 && (
          <View
            style={{
              alignItems: 'center',
              marginBottom: theme.spacing[5],
            }}
          >
            <Text style={{ fontSize: 28 }}>🔥</Text>
            <Text
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.font.h3.size,
                fontWeight: theme.font.h3.weight,
              }}
            >
              {streakQ.data.currentStreak}-day streak
            </Text>
          </View>
        )}

        {tasksQ.isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : todaysTasks.length === 0 ? (
          <EmptyState />
        ) : (
          <StaggerList stagger={60}>
            {todaysTasks.map((t) => {
              const completionId = completionByTaskId.get(t.id);
              const isDone = Boolean(completionId);
              return (
                <TaskCard
                  key={t.id}
                  task={t}
                  done={isDone}
                  onToggle={() => {
                    if (isDone && completionId) {
                      undoDone.mutate(completionId);
                    } else {
                      markDone.mutate({ taskId: t.id, completedAt: todayStr });
                    }
                  }}
                />
              );
            })}
          </StaggerList>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState() {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.spacing[6] }}>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: theme.font.body.size,
          textAlign: 'center',
          marginBottom: theme.spacing[4],
        }}
      >
        Nothing scheduled for today.{'\n'}Add your first routine to get started.
      </Text>
      <NeuButton label="Add a routine" onPress={() => {}} />
    </View>
  );
}
