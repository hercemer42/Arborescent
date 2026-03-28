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

describe('per-file panel state', () => {
  beforeEach(() => {
    usePanelStore.setState({
      activeContent: null,
      previousContent: null,
      panelPosition: 'side',
      panelHeight: 300,
      panelWidth: 600,
    });
  });

  describe('per-file state management', () => {
    it('should show terminal only for the current file', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();

      expect(usePanelStore.getState().activeContent).toBe('terminal');

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      expect(usePanelStore.getState().activeContent).toBeNull();
    });

    it('should show browser only for the current file', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showBrowser();

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      expect(usePanelStore.getState().activeContent).toBeNull();
    });

    it('should show feedback and save previousContent only for the current file', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showFeedback();

      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().previousContent).toBe('terminal');

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      expect(usePanelStore.getState().activeContent).toBeNull();
      expect(usePanelStore.getState().previousContent).toBeNull();
    });

    it('should closeFeedback only for the current file', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      usePanelStore.getState().showBrowser();
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().closeFeedback();
      expect(usePanelStore.getState().activeContent).toBe('browser');

      usePanelStore.getState().setActiveFile('/project-a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('feedback');
    });

    it('should hidePanel only for the current file', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      usePanelStore.getState().showBrowser();

      usePanelStore.getState().hidePanel();
      expect(usePanelStore.getState().activeContent).toBeNull();

      usePanelStore.getState().setActiveFile('/project-a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('terminal');
    });

    it('should not affect other files when mutating one file', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      usePanelStore.getState().showBrowser();

      usePanelStore.getState().setActiveFile('/project-a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('terminal');

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      expect(usePanelStore.getState().activeContent).toBe('browser');
    });
  });

  describe('file switching via setActiveFile', () => {
    it('should change which file activeContent is returned for', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      usePanelStore.getState().showBrowser();

      usePanelStore.getState().setActiveFile('/project-a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('terminal');

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      expect(usePanelStore.getState().activeContent).toBe('browser');
    });

    it('should return null activeContent for a file with no panel state', () => {
      usePanelStore.getState().setActiveFile('/new-file.arbo');
      expect(usePanelStore.getState().activeContent).toBeNull();
    });

    it('should preserve each file state independently across rapid switches', () => {
      usePanelStore.getState().setActiveFile('/a.arbo');
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().setActiveFile('/b.arbo');
      usePanelStore.getState().showBrowser();
      usePanelStore.getState().setActiveFile('/c.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().setActiveFile('/a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('terminal');
      usePanelStore.getState().setActiveFile('/b.arbo');
      expect(usePanelStore.getState().activeContent).toBe('browser');
      usePanelStore.getState().setActiveFile('/c.arbo');
      expect(usePanelStore.getState().activeContent).toBe('feedback');
    });

    it('should return null activeContent when no file is active', () => {
      usePanelStore.getState().setActiveFile(null);
      expect(usePanelStore.getState().activeContent).toBeNull();
    });
  });

  describe('zoom tab resolution', () => {
    it('should resolve zoom path to parent file panel state', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().setActiveFile('zoom:///project-a.arbo#node-1');
      expect(usePanelStore.getState().activeContent).toBe('terminal');
    });

    it('should update parent file state when operating from a zoom tab', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().setActiveFile('zoom:///project-a.arbo#node-1');
      usePanelStore.getState().showBrowser();

      usePanelStore.getState().setActiveFile('/project-a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('browser');
    });

    it('should show same panel state switching between zoom tab and parent', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().setActiveFile('zoom:///project-a.arbo#node-1');
      expect(usePanelStore.getState().activeContent).toBe('feedback');

      usePanelStore.getState().setActiveFile('/project-a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('feedback');
    });
  });

  describe('global layout independence', () => {
    it('should not change panelPosition when switching files', () => {
      usePanelStore.getState().setPanelPosition('bottom');
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().setActiveFile('/project-b.arbo');

      expect(usePanelStore.getState().panelPosition).toBe('bottom');
    });

    it('should not change panelHeight or panelWidth when switching files', () => {
      usePanelStore.getState().setPanelHeight(500);
      usePanelStore.getState().setPanelWidth(800);
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().setActiveFile('/project-b.arbo');

      expect(usePanelStore.getState().panelHeight).toBe(500);
      expect(usePanelStore.getState().panelWidth).toBe(800);
    });

    it('should share layout changes across all files', () => {
      usePanelStore.getState().setActiveFile('/project-a.arbo');
      usePanelStore.getState().setPanelPosition('bottom');

      usePanelStore.getState().setActiveFile('/project-b.arbo');
      expect(usePanelStore.getState().panelPosition).toBe('bottom');
    });
  });

  describe('session persistence', () => {
    it('should include fileStates when saving session', () => {
      usePanelStore.getState().setActiveFile('/a.arbo');
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().setActiveFile('/b.arbo');
      usePanelStore.getState().showBrowser();

      const { fileStates } = usePanelStore.getState();
      expect(fileStates['/a.arbo']?.activeContent).toBe('terminal');
      expect(fileStates['/b.arbo']?.activeContent).toBe('browser');
    });

    it('should restore per-file state from session data', () => {
      usePanelStore.setState({
        fileStates: {
          '/a.arbo': { activeContent: 'terminal', previousContent: null },
          '/b.arbo': { activeContent: 'feedback', previousContent: 'browser' },
        },
      });

      usePanelStore.getState().setActiveFile('/a.arbo');
      expect(usePanelStore.getState().activeContent).toBe('terminal');

      usePanelStore.getState().setActiveFile('/b.arbo');
      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().previousContent).toBe('browser');
    });

    it('should handle empty fileStates gracefully', () => {
      usePanelStore.setState({ fileStates: {} });

      usePanelStore.getState().setActiveFile('/new.arbo');
      expect(usePanelStore.getState().activeContent).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should be a no-op when calling showTerminal with no active file', () => {
      usePanelStore.getState().setActiveFile(null);
      usePanelStore.getState().showTerminal();

      expect(usePanelStore.getState().activeContent).toBeNull();
    });

    it('should create default entry for unknown file path', () => {
      usePanelStore.getState().setActiveFile('/never-seen.arbo');
      expect(usePanelStore.getState().activeContent).toBeNull();
      expect(usePanelStore.getState().previousContent).toBeNull();
    });
  });
});
