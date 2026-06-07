import { useToastStore, type ToastOptions } from '../../toast/toastStore';
import { useActivityLogStore } from '../../activityLog/activityLogStore';
import type { ToastType } from '../../../components/ui/Toast';

const WORKFLOW_SOURCE = 'workflow';

function isLogOnly(type: ToastType, options?: ToastOptions): boolean {
  return type === 'info' && !options?.actions && !options?.persistent;
}

export function notifyWorkflow(message: string, type: ToastType, options?: ToastOptions): void {
  useActivityLogStore.getState().addEntry(message, type, WORKFLOW_SOURCE);

  if (isLogOnly(type, options)) return;

  const { addToast } = useToastStore.getState();
  if (options) {
    addToast(message, type, options);
  } else {
    addToast(message, type);
  }
}
