import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { MetricsDashboardClient } from './MetricsDashboardClient';

export default async function MetricsPage() {
  const { denied } = await requireSession('ADMIN');
  if (denied) return <AccessDenied />;

  return <MetricsDashboardClient />;
}
