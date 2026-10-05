'use client';

import React, { useCallback } from 'react';
import { useToast } from '@/lib/toast/toast-context';
import Toast from './Toast';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  const handleClose = useCallback((id: string) => removeToast(id), [removeToast]);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={handleClose} />
      ))}
    </div>
  );
}
