import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityLogPanel } from '../ActivityLogPanel';
import {
  useActivityLogStore,
  type ActivityLogEntry,
} from '../../../../store/activityLog/activityLogStore';

const makeEntry = (i: number, type: ActivityLogEntry['type'] = 'info'): ActivityLogEntry => ({
  id: `id-${i}`,
  message: `entry-${i}`,
  type,
  source: 'workflow',
  timestamp: 1_700_000_000_000 + i,
});

const seed = (entries: ActivityLogEntry[]) => useActivityLogStore.setState({ entries });

describe('ActivityLogPanel', () => {
  beforeEach(() => seed([]));

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
});
