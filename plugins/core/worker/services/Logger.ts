import { parentPort } from 'node:worker_threads';

class WorkerLogger {
  private send(level: string, message: string, context?: string, error?: Error): void {
    if (!parentPort) return;

    // Send log message to main process
    parentPort.postMessage({
      type: 'log',
      level,
      message,
      context,
      error: error ? { message: error.message, stack: error.stack } : undefined,
    });
  }

  info(message: string, context?: string): void {
    this.send('info', message, context);
  }

  warn(message: string, context?: string): void {
    this.send('warn', message, context);
  }

  error(message: string, error?: Error, context?: string): void {
    this.send('error', message, context, error);
  }

  log(level: string, message: string, context?: string, error?: Error): void {
    this.send(level, message, context, error);
  }
}

export const logger = new WorkerLogger();
