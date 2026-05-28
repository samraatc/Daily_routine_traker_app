'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';

import { api } from '@/lib/api';

type PendingBook = {
  id: string;
  title: string;
  author: string | null;
  ownerId: string;
  sizeBytes: number;
  pageCount: number | null;
  format: 'pdf' | 'epub';
  createdAt: string;
};

export default function ModerationPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'moderation'],
    queryFn: async () =>
      (await api.get<{ items: PendingBook[] }>('/admin/moderation?status=pending')).data.items,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/moderation/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'moderation'] }),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/moderation/${id}/reject`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'moderation'] }),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Moderation queue</h1>
      {q.isLoading ? (
        <p>Loading…</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-gray-600">Nothing pending. ✓</p>
      ) : (
        <div className="space-y-3">
          {q.data!.map((b) => (
            <div key={b.id} className="neu-card flex items-center justify-between">
              <div>
                <div className="font-semibold">{b.title}</div>
                <div className="text-sm text-gray-600">
                  {b.author ?? '—'} · {(b.sizeBytes / 1024 / 1024).toFixed(1)} MB ·{' '}
                  {b.pageCount ?? '?'} pages · {b.format}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Submitted {new Date(b.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="neu-btn !bg-green-600"
                  onClick={() => approve.mutate(b.id)}
                  disabled={approve.isPending}
                >
                  Approve
                </button>
                <button
                  className="neu-btn !bg-red-600"
                  onClick={() => {
                    const reason = window.prompt('Reason (optional):') ?? 'Not approved';
                    reject.mutate({ id: b.id, reason });
                  }}
                  disabled={reject.isPending}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
