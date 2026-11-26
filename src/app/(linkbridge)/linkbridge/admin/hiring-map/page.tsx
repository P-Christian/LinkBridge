// src/app/(linkbridge)/linkbridge/admin/hiring-map/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HiringMapScreen } from '@/modules/vos-admin/components/dashboard/hiring-map/HiringMapScreen';

export const metadata: Metadata = { title: 'Live Hiring Network | LinkBridge' };

export default function HiringMapPage() {
  return (
    <Suspense fallback={null}>
      <HiringMapScreen />
    </Suspense>
  );
}

