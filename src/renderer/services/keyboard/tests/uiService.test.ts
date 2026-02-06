import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetHotkeyConfig } from '../../../data/hotkeyConfig';
import { initializeUIService } from '../uiService';
import { setHotkeyContext, setInitialized } from '../hotkeyContext';

const mockCollaborate = vi.fn();

vi.mock('../../../utils/selectionUtils', () => ({
  hasTextSelection: () => false,
  isContentEditableFocused: () => false,
  isFocusInPanel: () => false,
  isFocusInTerminalOrBrowser: () => false,
}));

vi.mock('../shared', () => ({
  getActiveStore: () => ({
    getState: () => ({
      activeNodeId: 'node-1',
      nodes: { 'node-1': { id: 'node-1', content: 'Node', children: [], metadata: {} } },
      ancestorRegistry: {},
      actions: {
        collaborate: mockCollaborate,
      },
    }),
  }),
}));

vi.mock('../../../utils/nodeHelpers', () => ({
  getAppliedContextIdWithInheritance: () => null,
}));

vi.mock('../../../store/toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));

vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: {
    getState: () => ({ actions: {} }),
  },
}));

vi.mock('../../../store/search/searchStore', () => ({
  useSearchStore: {
    getState: () => ({ openSearch: vi.fn() }),
  },
}));

describe('uiService (collaborate hotkeys)', () => {
  beforeEach(() => {
    // Set up hotkey context for tests
    setInitialized(true);
    setHotkeyContext('tree');
    resetHotkeyConfig();
    mockCollaborate.mockReset();
  });

  it('should allow collaborate hotkey even when no context is set (default review context)', () => {
    const cleanup = initializeUIService(window);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      shiftKey: true,
    }));

    expect(mockCollaborate).toHaveBeenCalledWith('node-1');
    cleanup();
  });
});
