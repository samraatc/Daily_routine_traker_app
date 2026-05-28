'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

import { api } from '@/lib/api';

type Flag = {
  id: string;
  key: string;
  enabled: boolean;
  rolloutPercent: number;
};

export default function FeatureFlagsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: async () => (await api.get<Flag[]>('/admin/feature-flags')).data,
  });

  const upsert = useMutation({
    mutationFn: async (input: { key: string; enabled: boolean; rolloutPercent: number }) =>
      api.post('/admin/feature-flags', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  const [newKey, setNewKey] = useState('');

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Feature flags</h1>
      <div className="neu-card mb-4 flex gap-2">
        <input
          className="neu-input flex-1"
          placeholder="new_flag_key (snake_case)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <button
          className="neu-btn"
          disabled={!newKey || upsert.isPending}
          onClick={() => {
            upsert.mutate({ key: newKey, enabled: false, rolloutPercent: 0 });
            setNewKey('');
          }}
        >
          Create
        </button>
      </div>

      <div className="space-y-3">
        {(q.data ?? []).map((f) => (
          <div key={f.id} className="neu-card flex items-center justify-between">
            <div>
              <div className="font-mono">{f.key}</div>
              <div className="text-sm text-gray-600">
                {f.enabled ? 'enabled' : 'disabled'} · rollout {f.rolloutPercent}%
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="neu-btn"
                onClick={() =>
                  upsert.mutate({
                    key: f.key,
                    enabled: !f.enabled,
                    rolloutPercent: f.rolloutPercent,
                  })
                }
              >
                {f.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                className="neu-btn"
                onClick={() => {
                  const next = Math.min(100, f.rolloutPercent + 25);
                  upsert.mutate({ key: f.key, enabled: f.enabled, rolloutPercent: next });
                }}
              >
                +25%
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
