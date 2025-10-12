import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusCheckbox } from './StatusCheckbox';

describe('StatusCheckbox', () => {
  it('should render pending status', () => {
    render(<StatusCheckbox status="☐" onChange={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('☐');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: ☐');
  });

  it('should render completed status', () => {
    render(<StatusCheckbox status="✓" onChange={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('✓');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: ✓');
  });

  it('should render failed status', () => {
    render(<StatusCheckbox status="✗" onChange={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('✗');
    expect(button).toHaveClass('status-checkbox');
    expect(button).toHaveAttribute('aria-label', 'Status: ✗');
  });

  it('should cycle through statuses on click', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(<StatusCheckbox status="☐" onChange={handleChange} />);
    const button = screen.getByRole('button');

    await user.click(button);
    expect(handleChange).toHaveBeenCalledWith('✓');

    rerender(<StatusCheckbox status="✓" onChange={handleChange} />);

    await user.click(button);
    expect(handleChange).toHaveBeenCalledWith('✗');

    rerender(<StatusCheckbox status="✗" onChange={handleChange} />);

    await user.click(button);
    expect(handleChange).toHaveBeenCalledWith('☐');
  });

  it('should stop propagation on click', async () => {
    const handleChange = vi.fn();
    const handleParentClick = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={handleParentClick}>
        <StatusCheckbox status="☐" onChange={handleChange} />
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
        <StatusCheckbox status="☐" onChange={handleChange} />
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
