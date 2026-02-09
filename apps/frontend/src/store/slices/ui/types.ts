export type ToastType = "success" | "error" | "info"
export interface ToastState {
  id: string;
  message: string;
  type: ToastType;
}
export interface UiState {
  toasts: ToastState[];
}