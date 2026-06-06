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
  getEffectiveRootNodeId,
} from '../shared';

describe('keyboard shared utilities', () => {
  const mockWorkspaceStore = { getState: () => ({ activeNodeId: 'node-1' }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveFilePath.value = '/test/file.arbo';
    mockGetStoreForFile.mockReturnValue(mockWorkspaceStore);

    // Reset DOM
    document.body.innerHTML = '';
  });

  describe('getActiveStore', () => {
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

    it('should return active file store when focused element is outside the workspace', () => {
      const orphan = document.createElement('div');
      orphan.setAttribute('contenteditable', 'true');
      document.body.appendChild(orphan);
      orphan.focus();

      expect(getActiveStore()).toBe(mockWorkspaceStore);
    });

    it('should return null when no file is open', () => {
      mockActiveFilePath.value = null;

      const orphan = document.createElement('div');
      orphan.setAttribute('contenteditable', 'true');
      document.body.appendChild(orphan);
      orphan.focus();

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

  describe('getEffectiveRootNodeId', () => {
    it('should return null for a non-zoom active file path', () => {
      mockActiveFilePath.value = '/test/file.arbo';
      expect(getEffectiveRootNodeId()).toBeNull();
    });

    it('should return the zoomed node id when active file path is a zoom:// path', () => {
      mockActiveFilePath.value = 'zoom:///test/file.arbo#node-123';
      expect(getEffectiveRootNodeId()).toBe('node-123');
    });

    it('should return null when active file path is null', () => {
      mockActiveFilePath.value = null;
      expect(getEffectiveRootNodeId()).toBeNull();
    });

    it('should return null for a malformed zoom path without a #nodeId', () => {
      mockActiveFilePath.value = 'zoom:///test/file.arbo';
      expect(getEffectiveRootNodeId()).toBeNull();
    });
  });

});
