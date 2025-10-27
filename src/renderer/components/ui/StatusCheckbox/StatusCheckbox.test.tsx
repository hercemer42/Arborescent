import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusCheckbox } from './StatusCheckbox';

describe('StatusCheckbox', () => {
  it('should render pending status', () => {
    render(<StatusCheckbox status="pending" onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('☐');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: pending');
  });

  it('should render completed status', () => {
    render(<StatusCheckbox status="completed" onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('✓');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: completed');
  });

  it('should render failed status', () => {
    render(<StatusCheckbox status="failed" onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('✗');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: failed');
  });

  it('should call onToggle when clicked', async () => {
    const handleToggle = vi.fn();
    const user = userEvent.setup();

    render(<StatusCheckbox status="pending" onToggle={handleToggle} />);
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
        <StatusCheckbox status="pending" onToggle={handleToggle} />
      </div>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleToggle).toHaveBeenCalled();
    expect(handleParentClick).not.toHaveBeenCalled();
  });

  it('should not steal focus from active element', async () => {
    const handleToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <div>
        <input type="text" data-testid="focused-input" />
        <StatusCheckbox status="pending" onToggle={handleToggle} />
      </div>
    );

    const input = screen.getByTestId('focused-input');
    const button = screen.getByRole('button');

    await user.click(input);
    expect(input).toHaveFocus();

    await user.click(button);

    expect(input).toHaveFocus();
    expect(handleToggle).toHaveBeenCalled();
  });
});
