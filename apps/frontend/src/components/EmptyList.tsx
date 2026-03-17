import React from 'react';
interface EmptyListProps {
  message?: string;
  icon?: string;
  redirect?: string;
};

const EmptyList: React.FC<EmptyListProps> = ({ message, icon, redirect }) => {
  return <p className="text-center text-slate-500">{message || 'No items found.'}</p>
};
export default EmptyList;