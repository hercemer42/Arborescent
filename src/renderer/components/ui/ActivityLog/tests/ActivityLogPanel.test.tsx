import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityLogPanel } from '../ActivityLogPanel';
import { focusLogSession } from '../focusLogSession';
import {
  useActivityLogStore,
  type ActivityLogEntry,
} from '../../../../store/activityLog/activityLogStore';

vi.mock('../focusLogSession', () => ({ focusLogSession: vi.fn() }));

const makeEntry = (i: number, type: ActivityLogEntry['type'] = 'info'): ActivityLogEntry => ({
  id: `id-${i}`,
  message: `entry-${i}`,
  type,
  source: 'workflow',
  timestamp: 1_700_000_000_000 + i,
});

const seed = (entries: ActivityLogEntry[]) => useActivityLogStore.setState({ entries });

describe('ActivityLogPanel', () => {
  beforeEach(() => {
    seed([]);
    vi.mocked(focusLogSession).mockClear();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ActivityLogPanel isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the activity entries when open', () => {
    seed([makeEntry(1), makeEntry(2), makeEntry(3)]);
    render(<ActivityLogPanel isOpen onClose={vi.fn()} />);

    expect(screen.getByText('entry-1')).toBeInTheDocument();
    expect(screen.getByText('entry-3')).toBeInTheDocument();
  });

  it('lists the entries newest-first', () => {
    seed([makeEntry(1), makeEntry(2), makeEntry(3)]);
    render(<ActivityLogPanel isOpen onClose={vi.fn()} />);

    const order = screen.getAllByText(/^entry-\d+$/).map((n) => n.textContent);
    expect(order).toEqual(['entry-3', 'entry-2', 'entry-1']);
  });

  it('exposes the feed as an accessible polite live region (role=log, aria-live=polite)', () => {
    seed([makeEntry(1)]);
    render(<ActivityLogPanel isOpen onClose={vi.fn()} />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    seed([makeEntry(1)]);
    render(<ActivityLogPanel isOpen onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when there are no entries', () => {
    render(<ActivityLogPanel isOpen onClose={vi.fn()} />);
    expect(screen.getByText(/no (activity|entries)/i)).toBeInTheDocument();
  });

  it('renders the entries inside a fixed-height scroll region', () => {
    seed([makeEntry(1)]);
    const { container } = render(<ActivityLogPanel isOpen onClose={vi.fn()} />);
    expect(container.querySelector('.activity-log-panel-scroll')).toBeInTheDocument();
  });

  it('does not double-announce events that also surface as toasts (polite log, no nested role=alert)', () => {
    seed([makeEntry(1, 'error')]);
    render(<ActivityLogPanel isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('exposes each entry full message as a title tooltip', () => {
    seed([makeEntry(1), makeEntry(2)]);
    const { container } = render(<ActivityLogPanel isOpen onClose={vi.fn()} />);

    const messages = container.querySelectorAll('.activity-log-entry-message');
    expect(messages).toHaveLength(2);
    messages.forEach((el) => {
      expect(el).toHaveAttribute('title', el.textContent);
    });
  });

  it('calls onClose when the close button is clicked (regression guard for the toggle change)', () => {
    const onClose = vi.fn();
    seed([makeEntry(1)]);
    render(<ActivityLogPanel isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /close activity log/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a targeted entry as an interactive control inside the panel', () => {
    seed([{ ...makeEntry(1), sessionId: 'session-1' }]);
    render(<ActivityLogPanel isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /entry-1/ })).toBeInTheDocument();
  });

  it('renders a non-targeted entry with no interactive control (only the close button)', () => {
    seed([makeEntry(2)]);
    render(<ActivityLogPanel isOpen onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /entry-2/ })).not.toBeInTheDocument();
  });

  it('focuses the originating session and closes the panel when a targeted entry is clicked', () => {
    vi.mocked(focusLogSession).mockReturnValue(true);
    const onClose = vi.fn();
    seed([{ ...makeEntry(1), sessionId: 'session-1' }]);
    render(<ActivityLogPanel isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /entry-1/ }));
    expect(focusLogSession).toHaveBeenCalledWith('session-1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves the panel open when activation is a no-op (session not open)', () => {
    vi.mocked(focusLogSession).mockReturnValue(false);
    const onClose = vi.fn();
    seed([{ ...makeEntry(1), sessionId: 'session-1' }]);
    render(<ActivityLogPanel isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /entry-1/ }));
    expect(focusLogSession).toHaveBeenCalledWith('session-1');
    expect(onClose).not.toHaveBeenCalled();
  });
});
