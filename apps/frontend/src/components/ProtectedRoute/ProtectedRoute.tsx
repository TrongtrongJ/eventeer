import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { selectIsAuthenticated, selectUserAccessToken, selectUserRole } from '../../store/slices/auth/authSlice'
import { useAppSelector } from '../../store/hooks'
import type { ProtectedRouteProps } from './types'

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireRole }) => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const userRole = useAppSelector(selectUserRole)
  const accessToken = useAppSelector(selectUserAccessToken)
  const location = useLocation();

  const unmetRequiredRole = requireRole && Array.isArray(requireRole) 
    ? !requireRole.includes(userRole) 
    : (userRole !== requireRole)

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (unmetRequiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export { ProtectedRoute };
