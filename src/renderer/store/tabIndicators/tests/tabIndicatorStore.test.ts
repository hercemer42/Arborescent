import { describe, it, expect, beforeEach } from 'vitest';
import { useTabIndicatorStore, getIndicatorForFile } from '../tabIndicatorStore';

describe('tabIndicatorStore', () => {
  beforeEach(() => {
    useTabIndicatorStore.setState({ indicators: {} });
  });

  describe('updateIndicator', () => {
    it('should set feedbackPending for a file', () => {
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: true,
        workflowRunning: false,
        actionRequired: false,
      });

      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']?.feedbackPending).toBe(true);
    });

    it('should set workflowRunning for a file', () => {
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: false,
        workflowRunning: true,
        actionRequired: false,
      });

      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']?.workflowRunning).toBe(true);
    });

    it('should set actionRequired for a file', () => {
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: false,
        workflowRunning: false,
        actionRequired: true,
      });

      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']?.actionRequired).toBe(true);
    });

    it('should not affect other files when updating one file', () => {
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: true,
        workflowRunning: false,
        actionRequired: false,
      });
      useTabIndicatorStore.getState().updateIndicator('/project-b.arbo', {
        feedbackPending: false,
        workflowRunning: true,
        actionRequired: false,
      });

      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']?.feedbackPending).toBe(true);
      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']?.workflowRunning).toBe(false);
      expect(useTabIndicatorStore.getState().indicators['/project-b.arbo']?.workflowRunning).toBe(true);
    });

    it('should overwrite previous indicator state for a file', () => {
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: false,
        workflowRunning: true,
        actionRequired: false,
      });
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: false,
        workflowRunning: false,
        actionRequired: true,
      });

      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']?.workflowRunning).toBe(false);
      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']?.actionRequired).toBe(true);
    });
  });

  describe('removeIndicator', () => {
    it('should remove indicator state for a file', () => {
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: true,
        workflowRunning: false,
        actionRequired: false,
      });

      useTabIndicatorStore.getState().removeIndicator('/project-a.arbo');

      expect(useTabIndicatorStore.getState().indicators['/project-a.arbo']).toBeUndefined();
    });

    it('should not affect other files', () => {
      useTabIndicatorStore.getState().updateIndicator('/project-a.arbo', {
        feedbackPending: true, workflowRunning: false, actionRequired: false,
      });
      useTabIndicatorStore.getState().updateIndicator('/project-b.arbo', {
        feedbackPending: false, workflowRunning: true, actionRequired: false,
      });

      useTabIndicatorStore.getState().removeIndicator('/project-a.arbo');

      expect(useTabIndicatorStore.getState().indicators['/project-b.arbo']?.workflowRunning).toBe(true);
    });
  });

  describe('getIndicatorForFile', () => {
    it('should return indicator state for a file', () => {
      const indicators = {
        '/project-a.arbo': { feedbackPending: true, workflowRunning: false, actionRequired: false },
      };

      const result = getIndicatorForFile(indicators, '/project-a.arbo');
      expect(result.feedbackPending).toBe(true);
    });

    it('should return all-false for unknown file', () => {
      const result = getIndicatorForFile({}, '/unknown.arbo');
      expect(result.feedbackPending).toBe(false);
      expect(result.workflowRunning).toBe(false);
      expect(result.actionRequired).toBe(false);
    });

    it('should resolve zoom path to parent file indicator', () => {
      const indicators = {
        '/project-a.arbo': { feedbackPending: false, workflowRunning: true, actionRequired: false },
      };

      const result = getIndicatorForFile(indicators, 'zoom:///project-a.arbo#node-1');
      expect(result.workflowRunning).toBe(true);
    });

    it('should return all-false for null file path', () => {
      const result = getIndicatorForFile({}, null as unknown as string);
      expect(result.feedbackPending).toBe(false);
    });
  });
});
