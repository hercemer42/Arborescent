import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetHotkeyConfig } from '../../../data/hotkeyConfig';
import { initializeUIService } from '../uiService';
import { useHotkeyContextStore } from '../../../store/hotkey/hotkeyContextStore';

const mockCollaborate = vi.fn();

let isFocusInTerminalOrBrowserMock = false;

vi.mock('../../../utils/selectionUtils', () => ({
  hasTextSelection: () => false,
  isContentEditableFocused: () => false,
  isFocusInPanel: () => false,
  isFocusInTerminalOrBrowser: () => isFocusInTerminalOrBrowserMock,
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

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('uiService (collaborate hotkeys)', () => {
  beforeEach(() => {
    const hotkeyStore = useHotkeyContextStore.getState();
    hotkeyStore.setInitialized(true);
    hotkeyStore.setContext('tree');
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

describe('uiService (reload hotkey)', () => {
  beforeEach(() => {
    const hotkeyStore = useHotkeyContextStore.getState();
    hotkeyStore.setInitialized(true);
    hotkeyStore.setContext('global');
    resetHotkeyConfig();
    mockReload.mockReset();
  });

  it('should reload when Ctrl+R is pressed outside terminal/browser', () => {
    const cleanup = initializeUIService(window);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'r',
      ctrlKey: true,
    }));

    expect(mockReload).toHaveBeenCalled();
    cleanup();
  });

  it('should not reload when Ctrl+R is pressed in terminal/browser', () => {
    isFocusInTerminalOrBrowserMock = true;

    const cleanup = initializeUIService(window);

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'r',
      ctrlKey: true,
    }));

    expect(mockReload).not.toHaveBeenCalled();
    
    isFocusInTerminalOrBrowserMock = false;
    cleanup();
  });
});
