import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tab } from './Tab';

describe('Tab', () => {
  it('should render tab name', () => {
    render(
      <Tab
        displayName="test.arbo"
        isActive={false}
        onClick={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('test.arbo')).toBeInTheDocument();
  });

  it('should apply active class when active', () => {
    render(
      <Tab
        displayName="test.arbo"
        isActive={true}
        onClick={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const tab = screen.getByText('test.arbo').closest('.tab');
    expect(tab).toHaveClass('active');
  });

  it('should not apply active class when inactive', () => {
    render(
      <Tab
        displayName="test.arbo"
        isActive={false}
        onClick={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const tab = screen.getByText('test.arbo').closest('.tab');
    expect(tab).not.toHaveClass('active');
  });

  it('should call onClick when tab is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Tab
        displayName="test.arbo"
        isActive={false}
        onClick={handleClick}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByText('test.arbo'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Tab
        displayName="test.arbo"
        isActive={false}
        onClick={vi.fn()}
        onClose={handleClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Close tab' }));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it('should not call onClick when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const handleClose = vi.fn();

    render(
      <Tab
        displayName="test.arbo"
        isActive={false}
        onClick={handleClick}
        onClose={handleClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Close tab' }));
    expect(handleClick).not.toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalledOnce();
  });
});
