import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusCheckbox } from './StatusCheckbox';

describe('StatusCheckbox', () => {
  it('should render pending status', () => {
    render(<StatusCheckbox status="pending" onChange={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('☐');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: pending');
  });

  it('should render completed status', () => {
    render(<StatusCheckbox status="completed" onChange={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('✓');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: completed');
  });

  it('should render failed status', () => {
    render(<StatusCheckbox status="failed" onChange={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('✗');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: failed');
  });

  it('should cycle through statuses on click', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(<StatusCheckbox status="pending" onChange={handleChange} />);
    const button = screen.getByRole('button');

    await user.click(button);
    expect(handleChange).toHaveBeenCalledWith('completed');

    rerender(<StatusCheckbox status="completed" onChange={handleChange} />);

    await user.click(button);
    expect(handleChange).toHaveBeenCalledWith('failed');

    rerender(<StatusCheckbox status="failed" onChange={handleChange} />);

    await user.click(button);
    expect(handleChange).toHaveBeenCalledWith('pending');
  });

  it('should stop propagation on click', async () => {
    const handleChange = vi.fn();
    const handleParentClick = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={handleParentClick}>
        <StatusCheckbox status="pending" onChange={handleChange} />
      </div>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleChange).toHaveBeenCalled();
    expect(handleParentClick).not.toHaveBeenCalled();
  });

  it('should not steal focus from active element', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <div>
        <input type="text" data-testid="focused-input" />
        <StatusCheckbox status="pending" onChange={handleChange} />
      </div>
    );

    const input = screen.getByTestId('focused-input');
    const button = screen.getByRole('button');

    await user.click(input);
    expect(input).toHaveFocus();

    await user.click(button);

    expect(input).toHaveFocus();
    expect(handleChange).toHaveBeenCalled();
  });
});
