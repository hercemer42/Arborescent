import { create } from 'zustand';
import { ToastItem, ToastType } from '../../components/ui/Toast';
import { preserveFocusAcross } from '../../services/focusPreservation';

export interface ToastOptions {
  actions?: Array<{ label: string; onClick: () => void }>;
  persistent?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type: ToastType, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message: string, type: ToastType, options?: ToastOptions) => {
    preserveFocusAcross(() => {
      const id = `${Date.now()}-${Math.random()}`;
      set((state) => ({
        toasts: [...state.toasts, { id, message, type, ...options }],
      }));
    });
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));
