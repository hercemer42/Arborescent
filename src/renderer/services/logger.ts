import { ToastType } from '../components/Toast';
import { BaseLogger } from '../../shared/services/logger/BaseLogger';

type ToastCallback = (message: string, type: ToastType) => void;

class RendererLogger extends BaseLogger {
  private toastCallback?: ToastCallback;

  setToastCallback(callback: ToastCallback): void {
    this.toastCallback = callback;
  }

  warn(message: string, context?: string, showToast = false): void {
    super.warn(message, context);
    if (showToast && this.toastCallback) {
      this.toastCallback(message, 'warning');
    }
  }

  error(message: string, error?: Error, context?: string, showToast = true): void {
    this.log('error', message, context, error);
    if (showToast && this.toastCallback) {
      this.toastCallback(message, 'error');
    }
  }

  success(message: string, context?: string, showToast = true): void {
    this.log('info', message, context);
    if (showToast && this.toastCallback) {
      this.toastCallback(message, 'success');
    }
  }
}

export const logger = new RendererLogger();
