import { logger } from './logger';
import { useToastStore } from '../store/toast/toastStore';
import { ToastType } from '../components/Toast';

export function notifyError(
  message: string,
  error?: Error,
  context?: string,
  toastType: ToastType = 'error'
): void {
  logger.error(message, error, context);
  useToastStore.getState().addToast(message, toastType);
}

export function notifyWarning(message: string, context?: string): void {
  logger.warn(message, context);
  useToastStore.getState().addToast(message, 'warning');
}

export function notifySuccess(message: string, context?: string): void {
  if (context) {
    logger.info(message, context);
  }
  useToastStore.getState().addToast(message, 'success');
}

