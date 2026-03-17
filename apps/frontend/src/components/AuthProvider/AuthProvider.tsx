import React, { PropsWithChildren } from 'react'
import { useGetMeQuery } from '../../store/slices/auth/authApi'
import { useAppSelector } from '../../store/hooks'
import FullScreenLoader from '../Loader/FullScreenLoader';

const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const token = useAppSelector(state => state.auth.accessToken);
  
  // This query only runs if we have a token but NO user data yet
  const { isLoading } = useGetMeQuery(undefined, {
    skip: !token, // Don't even try if there's no token
  });

  // Handle the "Initial Boot" loading state
  if (token && isLoading) {
    return <FullScreenLoader message="Restoring session..." />;
  }

  // If the token was invalid (401), the baseQueryWithReauth 
  // we built will have already dispatched logout().
  
  return <>{children}</>;
};

export { AuthProvider };