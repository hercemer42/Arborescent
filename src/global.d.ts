// Global type definitions for Arborescent

import type { PluginPreloadAPI } from '../plugins/core/preload/preload';

declare global {
  interface Window {
    electron: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
      showOpenDialog: () => Promise<string | null>;
      showSaveDialog: () => Promise<string | null>;
      showUnsavedChangesDialog: (fileName: string) => Promise<number>;
      saveSession: (sessionData: string) => Promise<void>;
      getSession: () => Promise<string | null>;
      getTempDir: () => Promise<string>;
      createTempFile: (fileName: string, content: string) => Promise<string>;
      deleteTempFile: (filePath: string) => Promise<void>;
      listTempFiles: () => Promise<string[]>;
      saveTempFilesMetadata: (metadata: string) => Promise<void>;
      getTempFilesMetadata: () => Promise<string | null>;
      setMenuNewHandler: (callback: () => void) => void;
      setMenuOpenHandler: (callback: () => void) => void;
      setMenuSaveHandler: (callback: () => void) => void;
      setMenuSaveAsHandler: (callback: () => void) => void;
      setMainErrorHandler: (callback: (message: string) => void) => void;
      // Claude plugin methods (legacy)
      claudeGetProjectPath?: () => Promise<string>;
      claudeListSessions?: (projectPath: string) => Promise<unknown[]>;
      claudeSendToSession?: (sessionId: string, context: string, projectPath: string) => Promise<void>;
    } & PluginPreloadAPI;
  }
}

export {};
