import type { CreateTaskInput, Task, UpdateTaskInput } from '@app/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

const TASKS_KEY = ['tasks'] as const;

export function useTasksList(date?: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, { date }],
    queryFn: async () => {
      const res = await api.get<Task[]>('/tasks', { params: date ? { date } : {} });
      return res.data;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await api.post<Task>('/tasks', input);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTaskInput }) => {
      const res = await api.patch<Task>(`/tasks/${id}`, input);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
