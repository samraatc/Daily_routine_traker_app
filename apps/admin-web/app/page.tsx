'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const ALLOWED_ROLES = new Set(['moderator', 'admin', 'super_admin']);

export default function SignInPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && ALLOWED_ROLES.has(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const m = useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/login', { email, password });
      return res.data;
    },
    onSuccess: (data) => {
      if (!ALLOWED_ROLES.has(data.user.role)) {
        setError(
          `Your role (${data.user.role}) doesn't have access to the admin panel.`,
        );
        return;
      }
      setSession(data);
      router.replace('/dashboard');
    },
    onError: (err: any) => setError(err?.response?.data?.title ?? err.message),
  });

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md neu-card">
        <h1 className="text-3xl font-bold mb-2">Admin sign in</h1>
        <p className="text-gray-600 mb-6">Moderators and above.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            m.mutate();
          }}
          className="space-y-4"
        >
          <input
            className="neu-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="neu-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button className="neu-btn w-full" disabled={m.isPending} type="submit">
            {m.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
