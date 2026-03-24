import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockActiveFilePath } = vi.hoisted(() => ({
  mockActiveFilePath: { value: '/test/file.arbo' as string | null },
}));

const { mockGetStoreForFile } = vi.hoisted(() => ({
  mockGetStoreForFile: vi.fn(),
}));

vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: {
    getState: () => ({ activeFilePath: mockActiveFilePath.value }),
  },
}));

vi.mock('../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: mockGetStoreForFile,
  },
}));

import {
  getActiveStore,
  setActiveFeedbackStore,
} from '../shared';

describe('keyboard shared utilities', () => {
  const mockWorkspaceStore = { getState: () => ({ activeNodeId: 'node-1' }) };
  const mockFeedbackStore = { getState: () => ({ activeNodeId: 'feedback-1' }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveFilePath.value = '/test/file.arbo';
    mockGetStoreForFile.mockReturnValue(mockWorkspaceStore);
    setActiveFeedbackStore(null);

    // Reset DOM
    document.body.innerHTML = '';
  });

  describe('getActiveStore', () => {
    it('should return feedback store when focused element is inside .feedback-panel and feedback store is set', () => {
      setActiveFeedbackStore(mockFeedbackStore as never);

      const panel = document.createElement('div');
      panel.className = 'feedback-panel';
      const input = document.createElement('div');
      input.setAttribute('contenteditable', 'true');
      panel.appendChild(input);
      document.body.appendChild(panel);
      input.focus();

      expect(getActiveStore()).toBe(mockFeedbackStore);
    });

    it('should return active file store when focused element is in the workspace', () => {
      const workspace = document.createElement('div');
      workspace.className = 'workspace';
      const input = document.createElement('div');
      input.setAttribute('contenteditable', 'true');
      workspace.appendChild(input);
      document.body.appendChild(workspace);
      input.focus();

      expect(getActiveStore()).toBe(mockWorkspaceStore);
      expect(mockGetStoreForFile).toHaveBeenCalledWith('/test/file.arbo');
    });

    it('should return active file store when focused element is outside both workspace and feedback panel', () => {
      const orphan = document.createElement('div');
      orphan.setAttribute('contenteditable', 'true');
      document.body.appendChild(orphan);
      orphan.focus();

      expect(getActiveStore()).toBe(mockWorkspaceStore);
    });

    it('should return null when no file is open and focus is not in feedback panel', () => {
      mockActiveFilePath.value = null;

      const orphan = document.createElement('div');
      orphan.setAttribute('contenteditable', 'true');
      document.body.appendChild(orphan);
      orphan.focus();

      expect(getActiveStore()).toBeNull();
    });

    it('should return null when feedback store is not set and focus is inside .feedback-panel', () => {
      const panel = document.createElement('div');
      panel.className = 'feedback-panel';
      const input = document.createElement('div');
      input.setAttribute('contenteditable', 'true');
      panel.appendChild(input);
      document.body.appendChild(panel);
      input.focus();

      expect(getActiveStore()).toBeNull();
    });

    it('should return correct store when switching between tabs', () => {
      const storeA = { getState: () => ({ activeNodeId: 'a' }) };
      const storeB = { getState: () => ({ activeNodeId: 'b' }) };

      mockActiveFilePath.value = '/file-a.arbo';
      mockGetStoreForFile.mockImplementation((path: string) => {
        if (path === '/file-a.arbo') return storeA;
        if (path === '/file-b.arbo') return storeB;
        return null;
      });

      expect(getActiveStore()).toBe(storeA);

      mockActiveFilePath.value = '/file-b.arbo';
      expect(getActiveStore()).toBe(storeB);
    });
  });

  describe('setActiveFeedbackStore', () => {
    it('should set the feedback store reference', () => {
      setActiveFeedbackStore(mockFeedbackStore as never);

      const panel = document.createElement('div');
      panel.className = 'feedback-panel';
      const input = document.createElement('div');
      input.setAttribute('contenteditable', 'true');
      panel.appendChild(input);
      document.body.appendChild(panel);
      input.focus();

      expect(getActiveStore()).toBe(mockFeedbackStore);
    });

    it('should clear the feedback store reference when called with null', () => {
      setActiveFeedbackStore(mockFeedbackStore as never);
      setActiveFeedbackStore(null);

      const panel = document.createElement('div');
      panel.className = 'feedback-panel';
      const input = document.createElement('div');
      input.setAttribute('contenteditable', 'true');
      panel.appendChild(input);
      document.body.appendChild(panel);
      input.focus();

      expect(getActiveStore()).toBeNull();
    });
  });

});
