'use client';

import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { api } from '@/lib/api';

type AuditEntry = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const q = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async () => (await api.get<AuditEntry[]>('/admin/audit-log?limit=100')).data,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Audit log</h1>
      <div className="neu-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Actor</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Target</th>
              <th className="py-2 pr-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <td className="py-2 pr-3 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{r.actorId?.slice(0, 8) ?? '—'}</td>
                <td className="py-2 pr-3 font-mono">{r.action}</td>
                <td className="py-2 pr-3 text-xs">
                  {r.targetType ?? '—'}
                  {r.targetId ? ` · ${r.targetId.slice(0, 8)}` : ''}
                </td>
                <td className="py-2 pr-3 text-xs">{r.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
