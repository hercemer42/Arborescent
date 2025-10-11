import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpandToggle } from './ExpandToggle';

describe('ExpandToggle', () => {
  it('should render collapsed state', () => {
    render(<ExpandToggle expanded={false} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('▶');
    expect(button).toHaveAttribute('aria-label', 'Expand');
  });

  it('should render expanded state', () => {
    render(<ExpandToggle expanded={true} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('▼');
    expect(button).toHaveAttribute('aria-label', 'Collapse');
  });

  it('should call onToggle when clicked', async () => {
    const handleToggle = vi.fn();
    const user = userEvent.setup();

    render(<ExpandToggle expanded={false} onToggle={handleToggle} />);
    const button = screen.getByRole('button');

    await user.click(button);

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('should stop propagation on click', async () => {
    const handleToggle = vi.fn();
    const handleParentClick = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={handleParentClick}>
        <ExpandToggle expanded={false} onToggle={handleToggle} />
      </div>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleToggle).toHaveBeenCalledTimes(1);
    expect(handleParentClick).not.toHaveBeenCalled();
  });
});
