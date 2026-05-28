import type { Completion, CompletionResponse } from '@app/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

const KEY = ['completions'] as const;

export function useCompletions(from?: string, to?: string) {
  return useQuery({
    queryKey: [...KEY, { from, to }],
    queryFn: async () => {
      const res = await api.get<Completion[]>('/completions', { params: { from, to } });
      return res.data;
    },
  });
}

export function useMarkDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { taskId: string; completedAt?: string }) => {
      const res = await api.post<CompletionResponse>('/completions', vars);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useUndoCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/completions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
