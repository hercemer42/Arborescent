import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSavePanelSession, mockGetPanelSession } = vi.hoisted(() => ({
  mockSavePanelSession: vi.fn(),
  mockGetPanelSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    savePanelSession: mockSavePanelSession,
    getPanelSession: mockGetPanelSession,
  })),
}));

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { usePanelStore } from '../panelStore';

describe('panel session per-file persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePanelStore.setState({
      activeContent: null,
      previousContent: null,
      panelPosition: 'side',
      panelHeight: 300,
      panelWidth: 600,
      currentFilePath: null,
      fileStates: {},
    });
  });

  describe('fileStates round-trip preserves per-file activeContent', () => {
    it('should save fileStates with per-file activeContent', () => {
      usePanelStore.getState().setActiveFile('/a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().setActiveFile('/b.arbo');
      // b has no panel — activeContent is null

      const lastCall = mockSavePanelSession.mock.calls[mockSavePanelSession.mock.calls.length - 1][0];
      expect(lastCall.fileStates['/a.arbo'].activeContent).toBe('terminal');
      // b should not be in fileStates since no action was taken on it
    });

    it('should restore fileStates and wire correctly via setActiveFile', async () => {
      mockGetPanelSession.mockResolvedValue({
        panelPosition: 'side',
        panelHeight: 300,
        panelWidth: 600,
        activeContent: null,
        fileStates: {
          '/a.arbo': { activeContent: 'terminal', previousContent: null },
          '/b.arbo': { activeContent: null, previousContent: null },
        },
      });

      await usePanelStore.getState().restoreSession();

      usePanelStore.getState().setActiveFile('/a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('terminal');

      usePanelStore.getState().setActiveFile('/b.arbo');
      expect(usePanelStore.getState().activeContent).toBeNull();
    });

    it('should include fileStates in the saved session format', () => {
      usePanelStore.getState().setActiveFile('/a.arbo');
      usePanelStore.getState().showBrowser();

      const lastCall = mockSavePanelSession.mock.calls[mockSavePanelSession.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty('fileStates');
      expect(lastCall).toHaveProperty('panelPosition');
      expect(lastCall).toHaveProperty('panelHeight');
      expect(lastCall).toHaveProperty('panelWidth');
    });
  });

  describe('feedback activeContent degrades gracefully on restart', () => {
    it('should restore feedback activeContent without errors even when no collaboration state exists', async () => {
      mockGetPanelSession.mockResolvedValue({
        panelPosition: 'side',
        panelHeight: 300,
        panelWidth: 600,
        activeContent: null,
        fileStates: {
          '/a.arbo': { activeContent: 'feedback', previousContent: 'terminal' },
        },
      });

      await usePanelStore.getState().restoreSession();

      // setActiveFile should load the feedback state without errors
      // even though there's no backing collaboration data
      usePanelStore.getState().setActiveFile('/a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().previousContent).toBe('terminal');
    });

    it('should allow closeFeedback to fall back to previousContent after restore', async () => {
      mockGetPanelSession.mockResolvedValue({
        panelPosition: 'side',
        panelHeight: 300,
        panelWidth: 600,
        activeContent: null,
        fileStates: {
          '/a.arbo': { activeContent: 'feedback', previousContent: 'browser' },
        },
      });

      await usePanelStore.getState().restoreSession();
      usePanelStore.getState().setActiveFile('/a.arbo');
      usePanelStore.getState().closeFeedback();

      expect(usePanelStore.getState().activeContent).toBe('browser');
    });
  });

  describe('backward compatibility', () => {
    it('should handle saved session with no fileStates field', async () => {
      mockGetPanelSession.mockResolvedValue({
        panelPosition: 'bottom',
        panelHeight: 400,
        panelWidth: 700,
        activeContent: 'terminal',
      });

      await usePanelStore.getState().restoreSession();

      expect(usePanelStore.getState().panelPosition).toBe('bottom');
      expect(usePanelStore.getState().panelHeight).toBe(400);
      expect(usePanelStore.getState().fileStates).toEqual({});
    });

    it('should handle null session gracefully', async () => {
      mockGetPanelSession.mockResolvedValue(null);

      await expect(usePanelStore.getState().restoreSession()).resolves.not.toThrow();
      expect(usePanelStore.getState().fileStates).toEqual({});
    });
  });

  describe('removeFileState cleanup', () => {
    it('should remove a file entry from fileStates', () => {
      usePanelStore.getState().setActiveFile('/a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().removeFileState('/a.arbo');

      expect(usePanelStore.getState().fileStates['/a.arbo']).toBeUndefined();
    });

    it('should not affect other file entries', () => {
      usePanelStore.getState().setActiveFile('/a.arbo');
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().setActiveFile('/b.arbo');
      usePanelStore.getState().showBrowser();

      usePanelStore.getState().removeFileState('/a.arbo');

      expect(usePanelStore.getState().fileStates['/b.arbo']?.activeContent).toBe('browser');
    });
  });
});
