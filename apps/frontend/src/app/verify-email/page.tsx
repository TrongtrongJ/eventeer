'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';

type State = 'verifying' | 'success' | 'error';

/** Target of the link in the verification email: /verify-email?token=... */
export default function VerifyEmailPage() {
  const queryClient = useQueryClient();
  const verify = useMutation(orpc.auth.verifyEmail.mutationOptions());
  const [state, setState] = useState<State>('verifying');
  const started = useRef(false); // StrictMode runs effects twice; a token is single-use

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('error');
      return;
    }
    verify
      .mutateAsync({ token })
      .then(() => {
        setState('success');
        return queryClient.invalidateQueries({ queryKey: orpc.auth.key() });
      })
      .catch(() => setState('error'));
  }, [verify, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center space-y-4">
        {state === 'verifying' && <p className="text-gray-600">Verifying your email...</p>}
        {state === 'success' && (
          <>
            <h2 className="text-2xl font-bold text-gray-900">Email verified</h2>
            <p className="text-gray-600">Thanks! Your email address is confirmed.</p>
            <Link href="/" className="inline-block text-indigo-600 font-medium hover:text-indigo-500">Continue to Eventeer</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h2 className="text-2xl font-bold text-gray-900">Link invalid or expired</h2>
            <p className="text-gray-600">This verification link can&apos;t be used. Sign in to request a new one.</p>
            <Link href="/login" className="inline-block text-indigo-600 font-medium hover:text-indigo-500">Go to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
