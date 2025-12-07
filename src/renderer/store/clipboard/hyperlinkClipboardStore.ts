import { create } from 'zustand';

/**
 * Store for tracking "Copy as Hyperlink" operations.
 * Stores just the node ID that was copied - content is fetched at paste time.
 */
export interface HyperlinkClipboardContent {
  /** Node ID that was copied as hyperlink */
  nodeId: string;
  /** Content snapshot at copy time (for hyperlink display) */
  content: string;
  /** Timestamp when content was cached */
  timestamp: number;
}

interface HyperlinkClipboardState {
  cache: HyperlinkClipboardContent | null;
}

interface HyperlinkClipboardActions {
  setCache: (nodeId: string, content: string) => void;
  getCache: () => HyperlinkClipboardContent | null;
  clearCache: () => void;
  hasCache: () => boolean;
}

export type HyperlinkClipboardStore = HyperlinkClipboardState & HyperlinkClipboardActions;

export const useHyperlinkClipboardStore = create<HyperlinkClipboardStore>((set, get) => ({
  cache: null,

  setCache: (nodeId: string, content: string) => {
    set({
      cache: {
        nodeId,
        content,
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
