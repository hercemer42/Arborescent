import { useEffect } from 'react';
import { useToastStore } from './store/toast/toastStore';
import { logger } from './services/logger';
import { ElectronErrorService } from '@platform/error';

const errorService = new ElectronErrorService();

export function useAppErrorHandling() {
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    logger.setToastCallback(addToast);

    errorService.onError((message) => {
      logger.error(message, undefined, 'Main Process', true);
    });
  }, [addToast]);
}
