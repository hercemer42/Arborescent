import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tab } from '../Tab';

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

  describe('associated (linked to focused node) state', () => {
    it('applies the associated class when isAssociated is true and the tab is not active', () => {
      render(
        <Tab
          displayName="term-1"
          isActive={false}
          isAssociated={true}
          onClick={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const tab = screen.getByText('term-1').closest('.tab');
      expect(tab).toHaveClass('associated');
    });

    it('does not apply the associated class when the tab is the active tab (active wins on conflict)', () => {
      render(
        <Tab
          displayName="term-1"
          isActive={true}
          isAssociated={true}
          onClick={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const tab = screen.getByText('term-1').closest('.tab');
      expect(tab).toHaveClass('active');
      expect(tab).not.toHaveClass('associated');
    });

    it('does not apply the associated class when isAssociated is false', () => {
      render(
        <Tab
          displayName="term-1"
          isActive={false}
          isAssociated={false}
          onClick={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const tab = screen.getByText('term-1').closest('.tab');
      expect(tab).not.toHaveClass('associated');
    });

    it('does not apply the associated class when isAssociated is omitted (default)', () => {
      render(
        <Tab
          displayName="term-1"
          isActive={false}
          onClick={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const tab = screen.getByText('term-1').closest('.tab');
      expect(tab).not.toHaveClass('associated');
    });

    it('still renders the active class when isActive is true regardless of isAssociated', () => {
      render(
        <Tab
          displayName="term-1"
          isActive={true}
          isAssociated={false}
          onClick={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const tab = screen.getByText('term-1').closest('.tab');
      expect(tab).toHaveClass('active');
    });

    it('does not interfere with the existing close-button behavior when associated', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Tab
          displayName="term-1"
          isActive={false}
          isAssociated={true}
          onClick={vi.fn()}
          onClose={handleClose}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Close tab' }));
      expect(handleClose).toHaveBeenCalledOnce();
    });
  });

  describe('review-pending highlight', () => {
    it('applies the review-pending class when pending and not active', () => {
      render(
        <Tab displayName="Node 1" isActive={false} isZoomTab isReviewPending onClick={vi.fn()} onClose={vi.fn()} />,
      );

      expect(screen.getByText('Node 1').closest('.tab')).toHaveClass('review-pending');
    });

    it('does not apply the review-pending class while the tab is active', () => {
      render(
        <Tab displayName="Node 1" isActive={true} isZoomTab isReviewPending onClick={vi.fn()} onClose={vi.fn()} />,
      );

      expect(screen.getByText('Node 1').closest('.tab')).not.toHaveClass('review-pending');
    });
  });
});
