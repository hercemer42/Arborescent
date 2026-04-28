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

  describe('showFeedbackForFile', () => {
    it('opens the feedback panel like showFeedback when target equals the active file', () => {
      usePanelStore.getState().showFeedbackForFile('/test/file.arbo');

      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().fileStates['/test/file.arbo'].activeContent).toBe('feedback');
    });

    it('records feedback in fileStates for a non-active file without changing the visible panel', () => {
      usePanelStore.getState().showBrowser();
      usePanelStore.getState().showFeedbackForFile('/other/file.arbo');

      expect(usePanelStore.getState().activeContent).toBe('browser');
      expect(usePanelStore.getState().fileStates['/other/file.arbo'].activeContent).toBe('feedback');
    });

    it('preserves the prior content for the target file as previousContent', () => {
      usePanelStore.setState({
        fileStates: {
          '/other/file.arbo': { activeContent: 'browser', previousContent: null },
        },
      });

      usePanelStore.getState().showFeedbackForFile('/other/file.arbo');

      expect(usePanelStore.getState().fileStates['/other/file.arbo']).toEqual({
        activeContent: 'feedback',
        previousContent: 'browser',
      });
    });

    it('after recording feedback for a file, switching back to it surfaces the panel', () => {
      usePanelStore.getState().showFeedbackForFile('/other/file.arbo');
      // simulate the user switching tabs to that file
      usePanelStore.getState().setActiveFile('/other/file.arbo');

      expect(usePanelStore.getState().activeContent).toBe('feedback');
    });

    it('is a no-op for a null file path', () => {
      usePanelStore.getState().showBrowser();
      usePanelStore.getState().showFeedbackForFile(null);

      expect(usePanelStore.getState().activeContent).toBe('browser');
    });
  });
});
