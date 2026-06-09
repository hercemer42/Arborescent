import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityLogEntries } from '../ActivityLogEntries';
import type { ActivityLogEntry } from '../../../../store/activityLog/activityLogStore';

const makeEntry = (i: number, message = `entry-${i}`): ActivityLogEntry => ({
  id: `id-${i}`,
  message,
  type: 'info',
  source: 'workflow',
  timestamp: 1_700_000_000_000 + i,
});

describe('ActivityLogEntries — full-message tooltip', () => {
  it('exposes each entry message as a title tooltip on the message span', () => {
    const { container } = render(<ActivityLogEntries entries={[makeEntry(1), makeEntry(2)]} />);

    const messages = container.querySelectorAll('.activity-log-entry-message');
    expect(messages).toHaveLength(2);
    messages.forEach((el) => {
      expect(el).toHaveAttribute('title', el.textContent);
    });
  });

  it('preserves a long message in full in the title (no truncation or reformatting)', () => {
    const long = `Advanced "${'X'.repeat(400)}" to Step 9`;
    const { container } = render(<ActivityLogEntries entries={[makeEntry(1, long)]} />);

    expect(container.querySelector('.activity-log-entry-message')).toHaveAttribute('title', long);
  });

  it('renders no rows and does not throw for an empty entry list', () => {
    const { container } = render(<ActivityLogEntries entries={[]} />);
    expect(container.querySelectorAll('.activity-log-entry-message')).toHaveLength(0);
  });
});

describe('ActivityLogEntries — interactive side-panel entries', () => {
  const targeted = (i: number) => ({ ...makeEntry(i), sessionId: `session-${i}` });

  it('renders a targeted entry as a keyboard-focusable button carrying the message when interactive', () => {
    render(<ActivityLogEntries entries={[targeted(1)]} interactive onActivateEntry={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('entry-1');
    expect(button.tabIndex).toBe(0);
  });

  it('exposes an accessible name referencing the entry message', () => {
    render(<ActivityLogEntries entries={[targeted(4)]} interactive onActivateEntry={vi.fn()} />);
    expect(screen.getByRole('button', { name: /entry-4/ })).toBeInTheDocument();
  });

  it('calls onActivateEntry with the entry when clicked', () => {
    const onActivateEntry = vi.fn();
    const entry = targeted(1);
    render(<ActivityLogEntries entries={[entry]} interactive onActivateEntry={onActivateEntry} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onActivateEntry).toHaveBeenCalledTimes(1);
    expect(onActivateEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: entry.id, sessionId: 'session-1' }),
    );
  });

  it('does not render a button for an entry without a sessionId, even when interactive', () => {
    render(<ActivityLogEntries entries={[makeEntry(2)]} interactive onActivateEntry={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never renders a button when not interactive, even for a targeted entry (popover behaviour)', () => {
    render(<ActivityLogEntries entries={[targeted(3)]} onActivateEntry={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the control as a native button so Enter and Space activate it', () => {
    render(<ActivityLogEntries entries={[targeted(1)]} interactive onActivateEntry={vi.fn()} />);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });
});
