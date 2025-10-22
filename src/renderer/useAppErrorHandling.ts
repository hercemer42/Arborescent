import { useEffect } from 'react';
import { useToastStore } from './store/toast/toastStore';
import { logger } from './services/logger';
import { ErrorService } from '@platform';

const errorService = new ErrorService();

export function useAppErrorHandling() {
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    logger.setToastCallback(addToast);

    errorService.onError((message) => {
      logger.error(message, undefined, 'Main Process', true);
    });
  }, [addToast]);
}
