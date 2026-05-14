import { ToastType } from '../components/ui/Toast';
import { BaseLogger } from '../../shared/services/logger/BaseLogger';
import type { LogLevel, LogMeta } from '../../shared/services/logger/LoggerInterface';

type ToastCallback = (message: string, type: ToastType) => void;

class RendererLogger extends BaseLogger {
  private toastCallback?: ToastCallback;

  setToastCallback(callback: ToastCallback): void {
    this.toastCallback = callback;
  }

  warn(message: string, context?: string, metaOrShowToast?: LogMeta | boolean, showToast = false): void {
    const { meta, toast } = normaliseMeta(metaOrShowToast, showToast);
    this.log('warn', message, context, undefined, meta);
    if (toast && this.toastCallback) {
      this.toastCallback(message, 'warning');
    }
  }

  error(
    message: string,
    error?: Error,
    context?: string,
    metaOrShowToast?: LogMeta | boolean,
    showToast = true,
  ): void {
    const { meta, toast } = normaliseMeta(metaOrShowToast, showToast);
    this.log('error', message, context, error, meta);
    if (toast && this.toastCallback) {
      this.toastCallback(message, 'error');
    }
  }

  success(message: string, context?: string, metaOrShowToast?: LogMeta | boolean, showToast = true): void {
    const { meta, toast } = normaliseMeta(metaOrShowToast, showToast);
    this.log('info', message, context, undefined, meta);
    if (toast && this.toastCallback) {
      this.toastCallback(message, 'success');
    }
  }

  protected output(
    level: LogLevel,
    message: string,
    context?: string,
    error?: Error,
    meta?: LogMeta,
  ): void {
    super.output(level, message, context, error, meta);
    forwardToMain(level, message, context, meta, error);
  }
}

function normaliseMeta(
  metaOrShowToast: LogMeta | boolean | undefined,
  fallbackShowToast: boolean,
): { meta?: LogMeta; toast: boolean } {
  if (typeof metaOrShowToast === 'boolean') {
    return { meta: undefined, toast: metaOrShowToast };
  }
  return { meta: metaOrShowToast, toast: fallbackShowToast };
}

function forwardToMain(
  level: LogLevel,
  message: string,
  context: string | undefined,
  meta: LogMeta | undefined,
  error?: Error,
): void {
  const bridge = typeof window !== 'undefined' ? window.electron?.appendLog : undefined;
  if (!bridge) return;
  try {
    void bridge({
      level,
      message,
      context,
      nodeId: meta?.nodeId,
      errorStack: error?.stack,
    });
  } catch {
    // bridge failures must not break the call site
  }
}

export const logger = new RendererLogger();
