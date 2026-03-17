import React from 'react';

interface LoaderProps {
  message?: string
}

const FullScreenLoader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-slate-950">
      {/* The Spinner */}
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-800 dark:border-t-blue-500" />
      
      {/* Subtle Text */}
      <p className="mt-4 animate-pulse text-sm font-medium text-slate-500 dark:text-slate-400">
        { message || 'Loading...'}
      </p>
    </div>
  );
};

export default FullScreenLoader;