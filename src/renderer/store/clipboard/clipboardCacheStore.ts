import { create } from 'zustand';

/**
 * Cached clipboard content for internal copy/paste operations.
 * Stores just the root node IDs - the actual nodes are looked up from
 * the tree store at paste time, preserving full metadata.
 */
export interface ClipboardCacheContent {
  /** Root node IDs that were copied/cut (top-level selections) */
  rootNodeIds: string[];
  /** All node IDs marked as cut (roots + descendants), only set for cut operations */
  allCutNodeIds?: string[];
  /** Timestamp when content was cached */
  timestamp: number;
  /** Whether this is a cut (move) or copy operation */
  isCut: boolean;
}

interface ClipboardCacheState {
  /** Cached clipboard content, or null if empty */
  cache: ClipboardCacheContent | null;
}

interface ClipboardCacheActions {
  /** Set the clipboard cache with copied/cut node IDs */
  setCache: (rootNodeIds: string[], isCut: boolean, allCutNodeIds?: string[]) => void;
  /** Get the current cache content */
  getCache: () => ClipboardCacheContent | null;
  /** Clear the cache */
  clearCache: () => void;
  /** Check if cache has content */
  hasCache: () => boolean;
}

export type ClipboardCacheStore = ClipboardCacheState & ClipboardCacheActions;

export const useClipboardCacheStore = create<ClipboardCacheStore>((set, get) => ({
  cache: null,

  setCache: (rootNodeIds: string[], isCut: boolean, allCutNodeIds?: string[]) => {
    set({
      cache: {
        rootNodeIds,
        allCutNodeIds,
        timestamp: Date.now(),
        isCut,
      },
    });
  },

  getCache: () => get().cache,

  clearCache: () => {
    set({ cache: null });
  },

  hasCache: () => get().cache !== null,
}));
