import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { BottomStatusBar } from '../BottomStatusBar';
import { useFlashMessage } from '../hooks/useFlashMessage';
import {
  useActivityLogStore,
  type ActivityLogEntry,
} from '../../../store/activityLog/activityLogStore';
import { useActivityLogViewStore } from '../../../store/activityLog/activityLogViewStore';

// Isolate the activity-log recap from the bar's other status sources.
vi.mock('../hooks/useFlashMessage', () => ({ useFlashMessage: vi.fn(() => null) }));
vi.mock('../hooks/useFeedbackStatus', () => ({ useFeedbackStatus: () => null }));
vi.mock('../hooks/useBlueprintModeStatus', () => ({ useBlueprintModeStatus: () => false }));

const makeEntry = (i: number): ActivityLogEntry => ({
  id: `id-${i}`,
  message: `Advanced "X" to Step ${i}`,
  type: 'info',
  source: 'workflow',
  timestamp: 1_700_000_000_000 + i,
});

describe('BottomStatusBar — activity log recap', () => {
  beforeEach(() => {
    vi.mocked(useFlashMessage).mockReturnValue(null);
    useActivityLogStore.setState({ entries: [] });
    useActivityLogViewStore.setState({ isPanelOpen: false, lastSeenTimestamp: 0 });
  });

  it('shows the most recent activity entry inline', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1), makeEntry(2)] });
    render(<BottomStatusBar />);

    expect(screen.getByText('Advanced "X" to Step 2')).toBeInTheDocument();
  });

  it('updates the inline entry as new entries arrive', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);
    expect(screen.getByText('Advanced "X" to Step 1')).toBeInTheDocument();

    act(() => {
      useActivityLogStore.getState().addEntry('Advanced "X" to Step 9', 'info', 'workflow');
    });
    expect(screen.getByText(/Step 9/)).toBeInTheDocument();
  });

  it('exposes the recap region as a keyboard-focusable control that opens the log', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('reveals the popover on hover and hides it when the pointer leaves', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    const { container } = render(<BottomStatusBar />);
    const recap = container.querySelector('.activity-recap')!;

    expect(container.querySelector('.activity-log-popover')).not.toBeInTheDocument();
    fireEvent.mouseEnter(recap);
    expect(container.querySelector('.activity-log-popover')).toBeInTheDocument();
    fireEvent.mouseLeave(recap);
    expect(container.querySelector('.activity-log-popover')).not.toBeInTheDocument();
  });

  it('reveals the popover when the recap is focused by keyboard and hides it on blur', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    const { container } = render(<BottomStatusBar />);

    expect(container.querySelector('.activity-log-popover')).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('button'));
    expect(container.querySelector('.activity-log-popover')).toBeInTheDocument();
    fireEvent.blur(screen.getByRole('button'));
    expect(container.querySelector('.activity-log-popover')).not.toBeInTheDocument();
  });

  it('opens the activity panel when the recap is clicked', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);

    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(false);
    fireEvent.click(screen.getByRole('button'));
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(true);
  });

  it('renders the recap alongside an active flash status (a separate region, it does not yield)', () => {
    vi.mocked(useFlashMessage).mockReturnValue('Feedback accepted');
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);

    expect(screen.getByText('Feedback accepted')).toBeInTheDocument();
    expect(screen.getByText('Advanced "X" to Step 1')).toBeInTheDocument();
  });

  it('surfaces an unread count of entries since last open and resets it when the panel opens', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1), makeEntry(2), makeEntry(3)] });
    render(<BottomStatusBar />);
    expect(screen.getByText('3')).toBeInTheDocument();

    act(() => {
      useActivityLogViewStore.getState().openPanel();
    });
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('does not steal focus from the tree when the inline entry updates', () => {
    const treeNode = document.createElement('input');
    document.body.appendChild(treeNode);
    treeNode.focus();

    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);
    expect(document.activeElement).toBe(treeNode);

    act(() => {
      useActivityLogStore.getState().addEntry('Advanced "X" to Step 9', 'info', 'workflow');
    });
    expect(document.activeElement).toBe(treeNode);

    treeNode.remove();
  });

  it('closes the panel when the recap is clicked a second time', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);
    const button = screen.getByRole('button');

    fireEvent.click(button);
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(true);
    fireEvent.click(button);
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(false);
  });

  it('toggles the panel open and closed across repeated recap clicks', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);
    const button = screen.getByRole('button');

    fireEvent.click(button);
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(true);
    fireEvent.click(button);
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(false);
    fireEvent.click(button);
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(true);
  });

  it('clears the unread badge when a recap click opens the panel', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1), makeEntry(2), makeEntry(3)] });
    render(<BottomStatusBar />);
    expect(screen.getByText('3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('reflects the panel open state via aria-expanded', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    render(<BottomStatusBar />);
    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
