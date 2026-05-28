import { NeuCard, useTheme } from '@app/ui';
import type { Task } from '@app/types';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export type TaskCardProps = {
  task: Task;
  done: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
};

export function TaskCard({ task, done, onToggle, onLongPress }: TaskCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${done ? ', completed' : ''}`}
      accessibilityState={{ checked: done }}
      style={{ marginBottom: theme.spacing[3] }}
    >
      <NeuCard inset={done}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: done ? theme.colors.accent.success : theme.colors.bg.surfacePressed,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {done && <Text style={{ color: '#FFF', fontWeight: '700' }}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.font.bodyMedium.size,
                lineHeight: theme.font.bodyMedium.lineHeight,
                fontWeight: theme.font.bodyMedium.weight,
                textDecorationLine: done ? 'line-through' : 'none',
                opacity: done ? 0.6 : 1,
              }}
            >
              {task.title}
            </Text>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.font.caption.size,
                marginTop: 2,
              }}
            >
              {task.time ?? 'Any time'} · {task.category}
            </Text>
          </View>
        </View>
      </NeuCard>
    </Pressable>
  );
}
