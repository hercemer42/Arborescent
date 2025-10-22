import { useEffect, useState } from 'react';
import { useFilesStore } from './store/files/filesStore';
import { logger } from './services/logger';
import { StorageService } from '@platform';

const storageService = new StorageService();

export function useAppInitialization() {
  const [isInitializing, setIsInitializing] = useState(true);
  const loadAndOpenFile = useFilesStore((state) => state.actions.loadAndOpenFile);
  const createNewFile = useFilesStore((state) => state.actions.createNewFile);

  useEffect(() => {
    const initializeApp = async () => {
      let hasOpenedFiles = false;

      const lastSession = storageService.getLastSession();
      const isTempFile = lastSession && storageService.isTempFile(lastSession);

      if (lastSession && !isTempFile) {
        try {
          await loadAndOpenFile(lastSession, 'SessionRestore', false);
          hasOpenedFiles = true;
        } catch (error) {
          logger.error(
            `Failed to restore session: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error : undefined,
            'SessionRestore',
            false
          );
        }
      }

      const tempFiles = storageService.getTempFiles();
      if (tempFiles.length > 0) {
        try {
          for (const tempPath of tempFiles) {
            await loadAndOpenFile(tempPath, 'SessionRestore', false);
          }

          logger.success(`Restored ${tempFiles.length} temporary file(s)`, 'SessionRestore', false);
          hasOpenedFiles = true;
        } catch (error) {
          logger.error(
            `Failed to restore temporary files: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error : undefined,
            'SessionRestore',
            false
          );
        }
      }

      if (!hasOpenedFiles) {
        await createNewFile();
      }

      setIsInitializing(false);
    };

    initializeApp();
  }, [loadAndOpenFile, createNewFile]);

  return { isInitializing };
}
