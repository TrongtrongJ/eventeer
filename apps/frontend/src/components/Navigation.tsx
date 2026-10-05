'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/lib/toast/toast-context';

export default function Navigation() {
  const { user, isAuthenticated } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const logoutMutation = useMutation(orpc.auth.logout.mutationOptions());

  const handleLogout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync(undefined);
    } catch (error: any) {
      console.error('Logout error:', error);
    } finally {
      // The backend clears the httpOnly cookies; clear our cached user state too.
      queryClient.removeQueries({ queryKey: orpc.auth.key() });
      addToast({ message: 'Logged out successfully', type: 'success' });
      router.push('/login');
      router.refresh();
    }
  }, [logoutMutation, queryClient, addToast, router]);

  const menuToggleHandler = useCallback(() => setIsMenuOpen((is) => !is), []);
  const menuCloseHandler = useCallback(() => setIsMenuOpen(false), []);

  const canCreateEvent =
    isAuthenticated && user && (user.role === 'ORGANIZER' || user.role === 'ADMIN');

  const userFirstName = user?.firstName?.[0] || '';
  const userLastName = user?.lastName?.[0] || '';
  const userFullName = `${userFirstName} ${userLastName}`;

  const signoutHandler = useCallback(() => {
    setIsMenuOpen(false);
    handleLogout();
  }, [handleLogout]);

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <h1 className="text-2xl font-bold text-indigo-600">Event Manager</h1>
            </Link>

            <div className="hidden md:ml-10 md:flex md:space-x-4">
              <Link
                href="/"
                className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Events
              </Link>

              {canCreateEvent && (
                <Link
                  href="/create"
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Create Event
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={menuToggleHandler}
                  aria-label="Account menu"
                  className="flex items-center space-x-3 focus:outline-none"
                >
                  {user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={userFullName} className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {userFirstName}
                        {userLastName}
                      </span>
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-medium text-gray-700">
                    {userFullName}
                  </span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-20">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                      onClick={menuCloseHandler}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={signoutHandler}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {isMenuOpen && <div className="fixed inset-0 z-10" onClick={menuCloseHandler} />}
    </nav>
  );
}
