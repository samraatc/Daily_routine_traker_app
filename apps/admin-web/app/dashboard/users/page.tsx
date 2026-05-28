'use client';

import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { api } from '@/lib/api';

export default function UsersPage() {
  // Note: the backend doesn't expose /admin/users list yet; render placeholder.
  const q = useQuery({
    queryKey: ['admin', 'users-placeholder'],
    queryFn: async () => (await api.get('/admin/dashboard')).data,
  });
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Users</h1>
      <div className="neu-card">
        <p className="text-gray-600">
          User search will live here (Phase 7). For now, role changes and suspensions are exposed
          via <code>PATCH /admin/users/:id</code> for admin+.
        </p>
        {q.data ? <p className="mt-3 text-sm">Total users (MAU): {q.data.users.mau}</p> : null}
      </div>
    </div>
  );
}
