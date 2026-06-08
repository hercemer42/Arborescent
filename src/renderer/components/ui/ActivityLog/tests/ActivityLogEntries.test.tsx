import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
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
