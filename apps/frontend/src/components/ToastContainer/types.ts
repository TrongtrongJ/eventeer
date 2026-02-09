import type { ToastState } from '../../store/slices/ui';
export interface ToastProps extends ToastState {
  onClose: (id: string) => void;
}