import { create } from 'zustand';

export interface ClipboardCacheContent {
  rootNodeIds: string[];
  allCutNodeIds?: string[];
  sourceFilePath?: string;
  timestamp: number;
  isCut: boolean;
  clipboardText: string;
}

interface ClipboardCacheState {
  cache: ClipboardCacheContent | null;
}

interface ClipboardCacheActions {
  setCache: (rootNodeIds: string[], isCut: boolean, clipboardText: string, allCutNodeIds?: string[], sourceFilePath?: string) => void;
  getCache: () => ClipboardCacheContent | null;
  clearCache: () => void;
  hasCache: () => boolean;
}

export type ClipboardCacheStore = ClipboardCacheState & ClipboardCacheActions;

export const useClipboardCacheStore = create<ClipboardCacheStore>((set, get) => ({
  cache: null,

  setCache: (rootNodeIds: string[], isCut: boolean, clipboardText: string, allCutNodeIds?: string[], sourceFilePath?: string) => {
    set({
      cache: {
        rootNodeIds,
        allCutNodeIds,
        sourceFilePath,
        timestamp: Date.now(),
        isCut,
        clipboardText,
      },
    });
  },

  getCache: () => get().cache,

  clearCache: () => {
    set({ cache: null });
  },

  hasCache: () => get().cache !== null,
}));
