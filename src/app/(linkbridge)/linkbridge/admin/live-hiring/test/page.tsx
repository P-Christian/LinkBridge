// src/app/(linkbridge)/linkbridge/admin/live-hiring/test/page.tsx
//
// /linkbridge/admin/live-hiring/test: test bench for the live hiring map.
// Runs in development. In a production build it is hidden (404) unless
// HIRING_MAP_LAB=on is set, so the fake-data tools never reach real admins by accident.
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HiringMapLab } from '@/modules/vos-admin/components/dashboard/hiring-map/HiringMapLab';

export const metadata: Metadata = { title: 'Live hiring · test lab | LinkBridge' };

export default function LiveHiringTestPage() {
  if (process.env.NODE_ENV === 'production' && process.env.HIRING_MAP_LAB !== 'on') notFound();
  return (
    <Suspense fallback={null}>
      <HiringMapLab />
    </Suspense>
  );
}
