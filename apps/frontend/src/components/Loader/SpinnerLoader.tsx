import React from 'react'

interface SpinnerLoaderProps {
  message?: string
}

const SpinnerLoader: React.FC<SpinnerLoaderProps> = ({ message }) => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

export default SpinnerLoader;
