import { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchStore } from '../../../store/search/searchStore';
import { useSearchMatches } from '../../../store/search/useSearchMatches';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

interface UseSearchBarResult {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  inputValue: string;
  totalMatches: number;
  matchDisplay: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handlePrevClick: () => void;
  handleNextClick: () => void;
  closeSearch: () => void;
}

export function useSearchBar(): UseSearchBarResult {
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldNavigateRef = useRef(false);
  const deferredUpdateRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isOpen = useSearchStore((state) => state.isOpen);
  const query = useSearchStore((state) => state.query);
  const currentMatchIndex = useSearchStore((state) => state.currentMatchIndex);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setMatchingNodeIds = useSearchStore((state) => state.setMatchingNodeIds);
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const nextMatch = useSearchStore((state) => state.nextMatch);
  const prevMatch = useSearchStore((state) => state.prevMatch);
  const setCurrentMatchIndex = useSearchStore((state) => state.setCurrentMatchIndex);

  // Local state for immediate input feedback
  const [inputValue, setInputValue] = useState(query);

  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;

  const nodes = activeStore?.getState().nodes ?? {};
  const rootNodeId = activeStore?.getState().rootNodeId ?? '';

  const computedMatches = useSearchMatches(query, nodes, rootNodeId);
  const totalMatches = computedMatches.length;

  // Sync local input when query changes externally (e.g., on close/reopen)
  useEffect(() => {
    setInputValue(query);
  }, [query]);

  // Update matching node IDs in store when they change
  useEffect(() => {
    setMatchingNodeIds(computedMatches);
  }, [computedMatches, setMatchingNodeIds]);

  // Focus input when search opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Navigate to current match (only when explicitly requested)
  const navigateToCurrentMatch = useCallback(() => {
    if (!activeStore || totalMatches === 0) return;

    const targetNodeId = computedMatches[currentMatchIndex];
    if (!targetNodeId) return;

    const { actions, nodes: storeNodes, ancestorRegistry } = activeStore.getState();

    // Expand ancestors of the target node
    const ancestors = ancestorRegistry[targetNodeId] || [];
    for (const ancestorId of ancestors) {
      const ancestor = storeNodes[ancestorId];
      if (ancestor && ancestor.metadata.expanded === false) {
        actions.toggleNode(ancestorId);
      }
    }

    // Scroll to the target node (but don't select it - let highlighting show it)
    activeStore.setState({ scrollToNodeId: targetNodeId });
  }, [activeStore, totalMatches, computedMatches, currentMatchIndex]);

  // Handle navigation when shouldNavigateRef is set
  useEffect(() => {
    if (shouldNavigateRef.current) {
      shouldNavigateRef.current = false;
      navigateToCurrentMatch();
    }
  }, [currentMatchIndex, navigateToCurrentMatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    } else if (e.key === 'Enter' || e.key === 'F3') {
      e.preventDefault();
      shouldNavigateRef.current = true;
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    }
  }, [closeSearch, nextMatch, prevMatch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Defer store update to next event loop tick for better batching
    if (deferredUpdateRef.current) {
      clearTimeout(deferredUpdateRef.current);
    }
    deferredUpdateRef.current = setTimeout(() => {
      setQuery(value);
    }, 0);
  }, [setQuery]);

  // Cleanup deferred update on unmount
  useEffect(() => {
    return () => {
      if (deferredUpdateRef.current) {
        clearTimeout(deferredUpdateRef.current);
      }
    };
  }, []);

  const handlePrevClick = useCallback(() => {
    shouldNavigateRef.current = true;
    prevMatch();
  }, [prevMatch]);

  const handleNextClick = useCallback(() => {
    shouldNavigateRef.current = true;
    nextMatch();
  }, [nextMatch]);

  // Reset match index if it's out of bounds
  useEffect(() => {
    if (currentMatchIndex >= totalMatches && totalMatches > 0) {
      setCurrentMatchIndex(0);
    }
  }, [totalMatches, currentMatchIndex, setCurrentMatchIndex]);

  const matchDisplay = query.trim()
    ? totalMatches > 0
      ? `${currentMatchIndex + 1} of ${totalMatches}`
      : 'No matches'
    : '';

  return {
    inputRef,
    isOpen,
    inputValue,
    totalMatches,
    matchDisplay,
    handleInputChange,
    handleKeyDown,
    handlePrevClick,
    handleNextClick,
    closeSearch,
  };
}
