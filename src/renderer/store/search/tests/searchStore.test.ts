import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore } from '../searchStore';

describe('searchStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSearchStore.setState({
      isOpen: false,
      query: '',
      currentMatchIndex: 0,
      matchingNodeIds: [],
    });
  });

  describe('openSearch', () => {
    it('should set isOpen to true', () => {
      useSearchStore.getState().openSearch();
      expect(useSearchStore.getState().isOpen).toBe(true);
    });
  });

  describe('closeSearch', () => {
    it('should reset all search state', () => {
      useSearchStore.setState({
        isOpen: true,
        query: 'test',
        currentMatchIndex: 5,
        matchingNodeIds: ['node-1', 'node-2'],
      });

      useSearchStore.getState().closeSearch();

      const state = useSearchStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.query).toBe('');
      expect(state.currentMatchIndex).toBe(0);
      expect(state.matchingNodeIds).toEqual([]);
    });
  });

  describe('setQuery', () => {
    it('should set query and reset currentMatchIndex', () => {
      useSearchStore.setState({ currentMatchIndex: 5 });

      useSearchStore.getState().setQuery('new search');

      const state = useSearchStore.getState();
      expect(state.query).toBe('new search');
      expect(state.currentMatchIndex).toBe(0);
    });
  });

  describe('setMatchingNodeIds', () => {
    it('should set matching node IDs', () => {
      useSearchStore.getState().setMatchingNodeIds(['node-1', 'node-2', 'node-3']);

      expect(useSearchStore.getState().matchingNodeIds).toEqual(['node-1', 'node-2', 'node-3']);
    });
  });

  describe('nextMatch', () => {
    it('should increment currentMatchIndex', () => {
      useSearchStore.setState({
        matchingNodeIds: ['node-1', 'node-2', 'node-3'],
        currentMatchIndex: 0,
      });

      useSearchStore.getState().nextMatch();

      expect(useSearchStore.getState().currentMatchIndex).toBe(1);
    });

    it('should wrap around to 0 at end', () => {
      useSearchStore.setState({
        matchingNodeIds: ['node-1', 'node-2', 'node-3'],
        currentMatchIndex: 2,
      });

      useSearchStore.getState().nextMatch();

      expect(useSearchStore.getState().currentMatchIndex).toBe(0);
    });

    it('should stay at 0 when no matches', () => {
      useSearchStore.setState({
        matchingNodeIds: [],
        currentMatchIndex: 0,
      });

      useSearchStore.getState().nextMatch();

      expect(useSearchStore.getState().currentMatchIndex).toBe(0);
    });
  });

  describe('prevMatch', () => {
    it('should decrement currentMatchIndex', () => {
      useSearchStore.setState({
        matchingNodeIds: ['node-1', 'node-2', 'node-3'],
        currentMatchIndex: 2,
      });

      useSearchStore.getState().prevMatch();

      expect(useSearchStore.getState().currentMatchIndex).toBe(1);
    });

    it('should wrap around to last at beginning', () => {
      useSearchStore.setState({
        matchingNodeIds: ['node-1', 'node-2', 'node-3'],
        currentMatchIndex: 0,
      });

      useSearchStore.getState().prevMatch();

      expect(useSearchStore.getState().currentMatchIndex).toBe(2);
    });

    it('should stay at 0 when no matches', () => {
      useSearchStore.setState({
        matchingNodeIds: [],
        currentMatchIndex: 0,
      });

      useSearchStore.getState().prevMatch();

      expect(useSearchStore.getState().currentMatchIndex).toBe(0);
    });
  });

  describe('setCurrentMatchIndex', () => {
    it('should set currentMatchIndex directly', () => {
      useSearchStore.getState().setCurrentMatchIndex(5);

      expect(useSearchStore.getState().currentMatchIndex).toBe(5);
    });
  });
});
