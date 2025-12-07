import { create } from 'zustand';

/**
 * Store for tracking "Copy as Hyperlink" operations.
 * Stores the node ID, content, and source file path.
 * Hyperlinks only work within the same document.
 */
export interface HyperlinkClipboardContent {
  /** Node ID that was copied as hyperlink */
  nodeId: string;
  /** Content snapshot at copy time (for hyperlink display) */
  content: string;
  /** Source file path (to prevent cross-document hyperlinks) */
  sourceFilePath: string;
  /** Timestamp when content was cached */
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
