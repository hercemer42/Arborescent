// Global type definitions for Arborescent

import type { PluginPreloadAPI } from '../plugins/core/preload/preload';

declare global {
  interface Window {
    electron: {
      platform: NodeJS.Platform;
      openExternal: (url: string) => Promise<void>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
      showOpenDialog: () => Promise<string | null>;
      showSaveDialog: (defaultPath?: string) => Promise<string | null>;
      showUnsavedChangesDialog: (fileName: string) => Promise<number>;
      saveSession: (sessionData: string) => Promise<void>;
      getSession: () => Promise<string | null>;
      saveBrowserSession: (sessionData: string) => Promise<void>;
      getBrowserSession: () => Promise<string | null>;
      savePanelSession: (sessionData: string) => Promise<void>;
      getPanelSession: () => Promise<string | null>;
      getTempDir: () => Promise<string>;
      createTempFile: (fileName: string, content: string) => Promise<string>;
      readTempFile: (filePath: string) => Promise<string | null>;
      deleteTempFile: (filePath: string) => Promise<void>;
      listTempFiles: () => Promise<string[]>;
      saveTempFilesMetadata: (metadata: string) => Promise<void>;
      getTempFilesMetadata: () => Promise<string | null>;
      isTempFile: (filePath: string) => Promise<boolean>;
      startClipboardMonitor: () => Promise<void>;
      stopClipboardMonitor: () => Promise<void>;
      onClipboardContentDetected: (callback: (content: string) => void) => () => void;
      startFeedbackFileWatcher: (filePath: string) => Promise<void>;
      stopFeedbackFileWatcher: () => Promise<void>;
      getFeedbackFilePath: () => Promise<string | null>;
      onFeedbackFileContentDetected: (callback: (content: string) => void) => () => void;
      setMenuNewHandler: (callback: () => void) => void;
      setMenuOpenHandler: (callback: () => void) => void;
      setMenuSaveHandler: (callback: () => void) => void;
      setMenuSaveAsHandler: (callback: () => void) => void;
      setMainErrorHandler: (callback: (message: string) => void) => void;
      // Terminal IPC
      terminalCreate: (id: string, title: string, shellCommand?: string, shellArgs?: string[], cwd?: string) => Promise<{
        id: string;
        title: string;
        cwd: string;
        shellCommand: string;
        shellArgs: string[];
      }>;
      terminalWrite: (id: string, data: string) => Promise<void>;
      terminalResize: (id: string, cols: number, rows: number) => Promise<void>;
      terminalDestroy: (id: string) => Promise<void>;
      onTerminalData: (id: string, callback: (data: string) => void) => () => void;
      onTerminalExit: (id: string, callback: (exitInfo: { exitCode: number; signal?: number }) => void) => () => void;
    } & PluginPreloadAPI;
  }
}

export {};
