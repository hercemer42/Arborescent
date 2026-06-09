import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLogPopover } from '../ActivityLogPopover';
import {
  useActivityLogStore,
  type ActivityLogEntry,
} from '../../../../store/activityLog/activityLogStore';

const makeEntry = (i: number): ActivityLogEntry => ({
  id: `id-${i}`,
  message: `entry-${i}`,
  type: 'info',
  source: 'workflow',
  timestamp: 1_700_000_000_000 + i,
});

const seed = (entries: ActivityLogEntry[]) => useActivityLogStore.setState({ entries });

describe('ActivityLogPopover', () => {
  beforeEach(() => seed([]));

  it('shows the last 5 entries, newest-first', () => {
    seed(Array.from({ length: 8 }, (_, i) => makeEntry(i)));
    render(<ActivityLogPopover />);

    const order = screen.getAllByText(/^entry-\d+$/).map((n) => n.textContent);
    expect(order).toEqual(['entry-7', 'entry-6', 'entry-5', 'entry-4', 'entry-3']);
  });

  it('shows all entries when fewer than 5 exist', () => {
    seed([makeEntry(1), makeEntry(2)]);
    render(<ActivityLogPopover />);

    expect(screen.getAllByText(/^entry-\d+$/)).toHaveLength(2);
  });

  it('renders no entry rows when the log is empty', () => {
    render(<ActivityLogPopover />);
    expect(screen.queryByText(/^entry-\d+$/)).not.toBeInTheDocument();
  });

  it('exposes each entry full message as a title tooltip', () => {
    seed([makeEntry(1), makeEntry(2)]);
    const { container } = render(<ActivityLogPopover />);

    const messages = container.querySelectorAll('.activity-log-entry-message');
    expect(messages).toHaveLength(2);
    messages.forEach((el) => {
      expect(el).toHaveAttribute('title', el.textContent);
    });
  });

  it('renders no interactive control even for a targeted entry (popover is not a focus trigger)', () => {
    seed([{ ...makeEntry(1), sessionId: 'session-1' }]);
    render(<ActivityLogPopover />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
