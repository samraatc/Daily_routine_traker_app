'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

import { useAuthStore } from '@/store/auth';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/moderation', label: 'Moderation' },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/feature-flags', label: 'Feature flags' },
  { href: '/dashboard/audit', label: 'Audit log' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace('/');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 p-6 neu-card m-4 mr-2">
        <div className="text-lg font-bold mb-6">Admin</div>
        <nav className="space-y-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block px-3 py-2 rounded-lg hover:bg-white/40"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-10 pt-6 border-t border-black/10">
          <div className="text-sm text-gray-600 mb-1">{user.email}</div>
          <div className="text-xs text-gray-500 mb-3">role: {user.role}</div>
          <button
            className="text-sm text-red-600 hover:underline"
            onClick={() => {
              signOut();
              router.replace('/');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
