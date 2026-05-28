'use client';

import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { api } from '@/lib/api';

type Dashboard = {
  users: { dau: number; mau: number };
  readingMinutes: { today: number; week: number; month: number };
  completionRate: number;
  pendingModerationCount: number;
  openReportsCount: number;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="neu-card">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

export default function DashboardOverview() {
  const q = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => (await api.get<Dashboard>('/admin/dashboard')).data,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Overview</h1>
      {q.isLoading ? (
        <p>Loading…</p>
      ) : q.error ? (
        <p className="text-red-600">Failed to load dashboard.</p>
      ) : q.data ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Stat label="Monthly Active Users" value={q.data.users.mau} />
          <Stat label="Pending moderation" value={q.data.pendingModerationCount} />
          <Stat label="Open reports" value={q.data.openReportsCount} />
          <Stat label="Reading (this month)" value={`${q.data.readingMinutes.month} min`} />
          <Stat label="Completion rate" value={`${q.data.completionRate}%`} />
        </div>
      ) : null}
    </div>
  );
}
