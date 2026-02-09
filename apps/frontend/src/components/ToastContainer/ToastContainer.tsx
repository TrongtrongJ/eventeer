import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { removeToast } from '../../store/slices/ui';
import Toast from './Toast'

const ToastContainer: React.FC = () => {
  const toasts = useSelector((state: RootState) => state.ui.toasts);
  const dispatch = useDispatch();

  const handleClose = useCallback((id: string) => {
    dispatch(removeToast(id));
  }, [dispatch]);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={handleClose} />
      ))}
    </div>
  );
};

export { ToastContainer };
