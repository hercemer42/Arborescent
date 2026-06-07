import { describe, it, expect, beforeEach } from 'vitest';
import { notifyWorkflow } from '../workflowToast';
import { useToastStore } from '../../../toast/toastStore';
import { useActivityLogStore } from '../../../activityLog/activityLogStore';

// notifyWorkflow is the single funnel for workflow-origin notifications: every
// event is recorded in the activity log, and a purely informational transition
// (info, no actions, not persistent) is suppressed as a toast.
describe('notifyWorkflow', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    useActivityLogStore.setState({ entries: [] });
  });

  it('logs a FYI info transition and suppresses the toast', () => {
    notifyWorkflow('Advanced "Task" to Step 2', 'info');

    expect(useToastStore.getState().toasts).toHaveLength(0);
    const { entries } = useActivityLogStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      message: 'Advanced "Task" to Step 2',
      type: 'info',
      source: 'workflow',
    });
  });

  it('shows and logs an error event', () => {
    notifyWorkflow('Failed to send — workflow stopped', 'error');

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useActivityLogStore.getState().entries).toHaveLength(1);
  });

  it('shows and logs a success event such as "Workflow complete"', () => {
    notifyWorkflow('Workflow complete for "Task"', 'success');

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useActivityLogStore.getState().entries).toHaveLength(1);
  });

  it('keeps an info event carrying actions/persistent as a toast and logs it', () => {
    notifyWorkflow('AI flagged questions for review', 'info', {
      persistent: true,
      actions: [{ label: 'Show', onClick: () => {} }],
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useActivityLogStore.getState().entries).toHaveLength(1);
  });

  it('records every transition during a decomposition burst without toasting', () => {
    const transitions = [
      'Advanced "A" to Step 2',
      'Advanced "B" to Step 2',
      'Advanced "C" to Step 2',
    ];
    for (const message of transitions) notifyWorkflow(message, 'info');

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(useActivityLogStore.getState().entries.map((e) => e.message)).toEqual(transitions);
  });

  it('leaves a non-workflow toast (plain addToast) visible and out of the activity log', () => {
    useToastStore.getState().addToast('Copied to clipboard', 'info');

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useActivityLogStore.getState().entries).toHaveLength(0);
  });
});
