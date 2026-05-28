import type { Metadata } from 'next';
import React from 'react';

import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daily Routine — Admin',
  description: 'Admin console for Daily Routine & E-Book Tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
