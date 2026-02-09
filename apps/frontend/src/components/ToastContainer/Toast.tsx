import React, { useEffect, memo } from 'react';
import { getToastColor } from './helpers'
import type { ToastProps } from './types'

const toastAutoCloseTime = 5000;

const Toast: React.FC<ToastProps> = memo(({ id, message, type, onClose }) => {

  useEffect(() => {
    const timer = setTimeout(() => onClose(id), toastAutoCloseTime);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const bgColor = getToastColor(type)

  return (
    <div
      className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center justify-between min-w-[300px] animate-slide-in`}
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

export default Toast