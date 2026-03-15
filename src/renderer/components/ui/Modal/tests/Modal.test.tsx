import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal', () => {
  const defaultProps = {
    title: 'Test Modal',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render title and children', () => {
      render(
        <Modal {...defaultProps}>
          <span>Modal content</span>
        </Modal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should have dialog role', () => {
      render(
        <Modal {...defaultProps}>
          <span>Content</span>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(
        <Modal {...defaultProps}>
          <span>Content</span>
        </Modal>
      );

      expect(screen.getByText('×')).toBeInTheDocument();
    });
  });

  describe('dismissal', () => {
    it('should call onClose when clicking outside the dialog', () => {
      const { container } = render(
        <Modal {...defaultProps}>
          <span>Content</span>
        </Modal>
      );

      const overlay = container.querySelector('.modal-overlay');
      fireEvent.mouseDown(overlay!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not call onClose when clicking inside the dialog', () => {
      const { container } = render(
        <Modal {...defaultProps}>
          <span>Content</span>
        </Modal>
      );

      const dialog = container.querySelector('.modal-dialog');
      fireEvent.mouseDown(dialog!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape is pressed', () => {
      render(
        <Modal {...defaultProps}>
          <span>Content</span>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', () => {
      render(
        <Modal {...defaultProps}>
          <span>Content</span>
        </Modal>
      );

      fireEvent.click(screen.getByText('×'));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
