import React from 'react';
import { UserRole } from '@event-mgmt/shared-schemas';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: UserRole;
}