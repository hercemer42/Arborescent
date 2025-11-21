import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewPanel } from '../ReviewPanel';

const mockHandleCancel = vi.fn();
const mockHandleAccept = vi.fn();
let mockReviewingNodeId: string | null = null;
let mockReviewedContent: string | null = null;

vi.mock('../../../store/tree/useStore', () => ({
  useStore: vi.fn((selector) => {
    const mockState = {
      reviewingNodeId: mockReviewingNodeId,
    };
    return selector(mockState);
  }),
}));

vi.mock('../hooks/useReviewClipboard', () => ({
  useReviewClipboard: vi.fn(() => mockReviewedContent),
}));

vi.mock('../hooks/useReviewActions', () => ({
  useReviewActions: vi.fn(() => ({
    handleCancel: mockHandleCancel,
    handleAccept: mockHandleAccept,
  })),
}));

vi.mock('../StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar">Status Bar</div>,
}));

describe('ReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewingNodeId = null;
    mockReviewedContent = null;
  });

  describe('when no review is active', () => {
    it('should show "No active review" message', () => {
      mockReviewingNodeId = null;

      render(<ReviewPanel />);

      expect(screen.getByText('No active review')).toBeInTheDocument();
      expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    });
  });

  describe('when review is active', () => {
    beforeEach(() => {
      mockReviewingNodeId = 'node-123';
    });

    it('should render status bar', () => {
      render(<ReviewPanel />);

      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    });

    it('should show "Waiting for reviewed content" when no content', () => {
      mockReviewedContent = null;

      render(<ReviewPanel />);

      expect(screen.getByText('Waiting for reviewed content...')).toBeInTheDocument();
      expect(screen.queryByText('Reviewed content:')).not.toBeInTheDocument();
    });

    it('should show reviewed content when available', () => {
      mockReviewedContent = '- Updated node\n  - Child node';

      const { container } = render(<ReviewPanel />);

      expect(screen.getByText('Reviewed content:')).toBeInTheDocument();
      const previewContent = container.querySelector('.review-preview-content');
      expect(previewContent?.textContent).toContain('Updated node');
      expect(previewContent?.textContent).toContain('Child node');
      expect(screen.queryByText('Waiting for reviewed content...')).not.toBeInTheDocument();
    });

    it('should render Cancel button that calls handleCancel', () => {
      render(<ReviewPanel />);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeInTheDocument();

      fireEvent.click(cancelButton);

      expect(mockHandleCancel).toHaveBeenCalledTimes(1);
    });

    it('should render Accept button', () => {
      render(<ReviewPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).toBeInTheDocument();
    });

    it('should disable Accept button when no reviewed content', () => {
      mockReviewedContent = null;

      render(<ReviewPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).toBeDisabled();
    });

    it('should enable Accept button when reviewed content is available', () => {
      mockReviewedContent = '- Updated node';

      render(<ReviewPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).not.toBeDisabled();
    });

    it('should call handleAccept with content and nodeId when Accept clicked', () => {
      mockReviewedContent = '- Updated node\n  - Child';
      mockReviewingNodeId = 'node-456';

      render(<ReviewPanel />);

      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      expect(mockHandleAccept).toHaveBeenCalledTimes(1);
      expect(mockHandleAccept).toHaveBeenCalledWith('- Updated node\n  - Child', 'node-456');
    });

    it('should have correct CSS classes for buttons', () => {
      render(<ReviewPanel />);

      const cancelButton = screen.getByText('Cancel');
      const acceptButton = screen.getByText('Accept');

      expect(cancelButton).toHaveClass('review-button', 'review-button-cancel');
      expect(acceptButton).toHaveClass('review-button', 'review-button-accept');
    });

    it('should have correct CSS classes for content sections', () => {
      mockReviewedContent = '- Node content';

      const { container } = render(<ReviewPanel />);

      expect(container.querySelector('.review-panel')).toBeInTheDocument();
      expect(container.querySelector('.review-content')).toBeInTheDocument();
      expect(container.querySelector('.review-preview')).toBeInTheDocument();
      expect(container.querySelector('.review-preview-header')).toBeInTheDocument();
      expect(container.querySelector('.review-preview-content')).toBeInTheDocument();
      expect(container.querySelector('.review-actions')).toBeInTheDocument();
    });
  });
});
