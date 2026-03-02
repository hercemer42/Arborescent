import { useEffect } from 'react';
import { useToastStore } from './store/toast/toastStore';
import { logger } from './services/logger';

export function useAppErrorHandling() {
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    logger.setToastCallback(addToast);

    window.electron.setMainErrorHandler((message) => {
      logger.error(message, undefined, 'Main Process', true);
    });
  }, [addToast]);
}
