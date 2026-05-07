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

describe('feedback panel close with concurrent automated and manual sessions', () => {
  beforeEach(() => {
    usePanelStore.setState({
      activeContent: null,
      previousContent: null,
      currentFilePath: null,
      fileStates: {},
      panelPosition: 'side',
      panelHeight: 300,
      panelWidth: 600,
    });
  });

  describe('automated accept on file A while manual feedback is in progress on file B', () => {
    it('does not close the feedback panel for file B when feedback for file A is closed', () => {
      usePanelStore.getState().setActiveFile('/file-a.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().setActiveFile('/file-b.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().closeFeedback('/file-a.arbo');

      expect(usePanelStore.getState().activeContent).toBe('feedback');
      expect(usePanelStore.getState().currentFilePath).toBe('/file-b.arbo');
    });

    it('clears feedback in fileStates for file A while leaving file B fileState untouched', () => {
      usePanelStore.getState().setActiveFile('/file-a.arbo');
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().setActiveFile('/file-b.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().closeFeedback('/file-a.arbo');

      const { fileStates } = usePanelStore.getState();
      expect(fileStates['/file-a.arbo'].activeContent).toBe('terminal');
      expect(fileStates['/file-b.arbo'].activeContent).toBe('feedback');
    });

    it('keeps file B as currentFilePath after closing file A feedback', () => {
      usePanelStore.getState().setActiveFile('/file-a.arbo');
      usePanelStore.getState().showFeedback();
      usePanelStore.getState().setActiveFile('/file-b.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().closeFeedback('/file-a.arbo');

      expect(usePanelStore.getState().currentFilePath).toBe('/file-b.arbo');
    });

    it('preserves file B previousContent after closing file A feedback', () => {
      usePanelStore.getState().setActiveFile('/file-a.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().setActiveFile('/file-b.arbo');
      usePanelStore.getState().showTerminal();
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().closeFeedback('/file-a.arbo');

      expect(usePanelStore.getState().previousContent).toBe('terminal');
    });
  });

  describe('automated and manual feedback on the same file', () => {
    it('does not close the panel when automated feedback is accepted while a manual session is also active');
    it('keeps the panel open until the last active feedback session for the file is resolved');
    it('preserves the manual session collaboratingNodeId after the automated session is accepted');
  });

  describe('manual accept while automated feedback is in progress', () => {
    it('does not close the panel when the automated session for another node is still running');
    it('closes the panel only when no other active feedback session remains');
  });

  describe('race conditions', () => {
    it('handles a manual session completing in the same tick as an automated accept');
    it('handles an automated accept arriving before a manual session has been registered');
    it('handles two automated sessions accepting concurrently');
  });

  describe('boundary and empty inputs', () => {
    it('does nothing when closeFeedback is called with no currentFilePath and no explicit path', () => {
      usePanelStore.getState().closeFeedback();

      expect(usePanelStore.getState().activeContent).toBeNull();
      expect(usePanelStore.getState().fileStates).toEqual({});
    });

    it('does nothing when closeFeedback is called with explicit null path', () => {
      usePanelStore.getState().setActiveFile('/file-a.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().closeFeedback(null);

      expect(usePanelStore.getState().activeContent).toBe('feedback');
    });

    it('does nothing when the target file has no feedback content active', () => {
      usePanelStore.getState().setActiveFile('/file-a.arbo');
      usePanelStore.getState().showTerminal();

      usePanelStore.getState().closeFeedback('/file-a.arbo');

      expect(usePanelStore.getState().activeContent).toBe('terminal');
    });

    it('handles closeFeedback when only one session exists and it is the one being closed', () => {
      usePanelStore.getState().setActiveFile('/file-a.arbo');
      usePanelStore.getState().showFeedback();

      usePanelStore.getState().closeFeedback('/file-a.arbo');

      expect(usePanelStore.getState().activeContent).toBeNull();
      expect(usePanelStore.getState().fileStates['/file-a.arbo'].activeContent).toBeNull();
    });
  });

  describe('error and failure states', () => {
    it('does not close the panel if the automated accept command throws');
    it('leaves panel state untouched when the automated session has no associated file path');
  });

  describe('repeated interactions', () => {
    it('remains correct after multiple sequential automated accepts with a persistent manual session');
    it('remains correct after the user toggles the panel between automated and manual sessions');
  });

  describe('accessibility and UX', () => {
    it('does not steal focus from the manual feedback panel when an automated accept resolves');
    it('does not announce panel-closed state to screen readers when the visible panel is unaffected');
  });
});
