import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    savePanelSession: vi.fn(),
    getPanelSession: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { usePanelStore } from '../panelStore';

describe('panelStore feedback restore', () => {
  beforeEach(() => {
    usePanelStore.setState({
      activeContent: null,
      previousContent: null,
      currentFilePath: '/test/file.arbo',
      fileStates: {},
      panelPosition: 'side',
      panelHeight: 300,
      panelWidth: 600,
    });
  });

  describe('showFeedback saves previous content', () => {
    it('should save terminal as previous content when switching to feedback', () => {
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showFeedback();

      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().previousContent).toBe('terminal');
    });

    it('should save browser as previous content when switching to feedback', () => {
      usePanelStore.getState().showBrowser();
      usePanelStore.getState().showFeedback();

      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().previousContent).toBe('browser');
    });

    it('should save null as previous content when no panel was open', () => {
      usePanelStore.getState().showFeedback();

      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().previousContent).toBeNull();
    });
  });

  describe('closeFeedback restores previous content', () => {
    it('should restore terminal after closing feedback', () => {
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showFeedback();
      usePanelStore.getState().closeFeedback();

      expect(usePanelStore.getState().activeContent).toBe('terminal');
    });

    it('should restore browser after closing feedback', () => {
      usePanelStore.getState().showBrowser();
      usePanelStore.getState().showFeedback();
      usePanelStore.getState().closeFeedback();

      expect(usePanelStore.getState().activeContent).toBe('browser');
    });

    it('should hide panel if no previous content existed', () => {
      usePanelStore.getState().showFeedback();
      usePanelStore.getState().closeFeedback();

      expect(usePanelStore.getState().activeContent).toBeNull();
    });

    it('should clear previousContent after restoring', () => {
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showFeedback();
      usePanelStore.getState().closeFeedback();

      expect(usePanelStore.getState().previousContent).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle closeFeedback when not in feedback mode as a no-op', () => {
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().closeFeedback();

      expect(usePanelStore.getState().activeContent).toBe('terminal');
    });

    it('should not track previous content for non-feedback panel switches', () => {
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showBrowser();

      expect(usePanelStore.getState().previousContent).toBeNull();
    });
  });
});
