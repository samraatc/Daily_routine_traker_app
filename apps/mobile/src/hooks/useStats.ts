import type { ReadingStats, WeeklyStats } from '@app/types';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useWeeklyStats() {
  return useQuery({
    queryKey: ['stats', 'weekly'],
    queryFn: async () => (await api.get<WeeklyStats>('/stats/weekly')).data,
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: ['stats', 'streaks'],
    queryFn: async () =>
      (
        await api.get<{
          currentStreak: number;
          longestStreak: number;
          lastCompletedDate: string | null;
        }>('/stats/streaks')
      ).data,
  });
}

export function useReadingStats() {
  return useQuery({
    queryKey: ['stats', 'reading'],
    queryFn: async () => (await api.get<ReadingStats>('/stats/reading')).data,
  });
}
