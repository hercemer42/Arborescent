import { create } from 'zustand';

interface SearchState {
  isOpen: boolean;
  query: string;
  currentMatchIndex: number;
  matchingNodeIds: string[];
  matchingNodeIdsSet: Set<string>;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  setMatchingNodeIds: (nodeIds: string[]) => void;
  setCurrentMatchIndex: (index: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
}

const emptySet = new Set<string>();

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: '',
  currentMatchIndex: 0,
  matchingNodeIds: [],
  matchingNodeIdsSet: emptySet,

  openSearch: () => set({ isOpen: true }),

  closeSearch: () => set({ isOpen: false, query: '', currentMatchIndex: 0, matchingNodeIds: [], matchingNodeIdsSet: emptySet }),

  setQuery: (query: string) => set({ query, currentMatchIndex: 0 }),

  setMatchingNodeIds: (nodeIds: string[]) => set({
    matchingNodeIds: nodeIds,
    matchingNodeIdsSet: new Set(nodeIds),
  }),

  setCurrentMatchIndex: (index: number) => set({ currentMatchIndex: index }),

  nextMatch: () => set((state) => {
    const total = state.matchingNodeIds.length;
    return {
      currentMatchIndex: total > 0
        ? (state.currentMatchIndex + 1) % total
        : 0,
    };
  }),

  prevMatch: () => set((state) => {
    const total = state.matchingNodeIds.length;
    return {
      currentMatchIndex: total > 0
        ? (state.currentMatchIndex - 1 + total) % total
        : 0,
    };
  }),
}));
