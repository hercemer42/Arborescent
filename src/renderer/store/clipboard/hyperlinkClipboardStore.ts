import { create } from 'zustand';

export interface HyperlinkClipboardContent {
  nodeId: string;
  content: string;
  sourceFilePath: string;
  timestamp: number;
}

interface HyperlinkClipboardState {
  cache: HyperlinkClipboardContent | null;
}

interface HyperlinkClipboardActions {
  setCache: (nodeId: string, content: string, sourceFilePath: string) => void;
  getCache: () => HyperlinkClipboardContent | null;
  clearCache: () => void;
  hasCache: () => boolean;
}

export type HyperlinkClipboardStore = HyperlinkClipboardState & HyperlinkClipboardActions;

export const useHyperlinkClipboardStore = create<HyperlinkClipboardStore>((set, get) => ({
  cache: null,

  setCache: (nodeId: string, content: string, sourceFilePath: string) => {
    set({
      cache: {
        nodeId,
        content,
        sourceFilePath,
        timestamp: Date.now(),
      },
    });
  },

  getCache: () => get().cache,

  clearCache: () => {
    set({ cache: null });
  },

  hasCache: () => get().cache !== null,
}));
