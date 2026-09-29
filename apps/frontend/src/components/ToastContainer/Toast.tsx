'use client';

import React, { useEffect, memo } from 'react';
import type { ToastState, ToastType } from '@/lib/toast/toast-context';

const toastAutoCloseTime = 5000;

const toastColorMap: Record<ToastType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

interface ToastProps extends ToastState {
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = memo(({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), toastAutoCloseTime);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  return (
    <div
      className={`${toastColorMap[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center justify-between min-w-[300px] animate-slide-in`}
    >
      <span>{message}</span>
      <button onClick={() => onClose(id)} className="ml-4 text-white hover:text-gray-200">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
});
Toast.displayName = 'Toast';

export default Toast;
