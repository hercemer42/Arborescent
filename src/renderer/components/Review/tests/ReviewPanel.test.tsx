import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewPanel } from '../ReviewPanel';

const mockHandleCancel = vi.fn();
const mockHandleAccept = vi.fn();
let mockReviewingNodeId: string | null = null;
let mockHasReviewContent = false;
let mockReviewStore: unknown = null;
let mockPanelPosition: 'side' | 'bottom' = 'side';
const mockTogglePanelPosition = vi.fn();

vi.mock('../../../store/tree/useStore', () => ({
  useStore: vi.fn((selector) => {
    const mockState = {
      reviewingNodeId: mockReviewingNodeId,
    };
    return selector(mockState);
  }),
}));

vi.mock('../../../store/panel/panelStore', () => ({
  usePanelStore: vi.fn((selector) => {
    const mockState = {
      panelPosition: mockPanelPosition,
      togglePanelPosition: mockTogglePanelPosition,
    };
    return selector(mockState);
  }),
}));

vi.mock('../hooks/useReviewClipboard', () => ({
  useReviewClipboard: vi.fn(() => mockHasReviewContent),
}));

vi.mock('../hooks/useReviewActions', () => ({
  useReviewActions: vi.fn(() => ({
    handleCancel: mockHandleCancel,
    handleAccept: mockHandleAccept,
  })),
}));

vi.mock('../../../store/review/reviewTreeStore', () => ({
  reviewTreeStore: {
    getStore: vi.fn(() => mockReviewStore),
  },
}));

vi.mock('../../Tree', () => ({
  Tree: () => <div data-testid="tree-component">Tree Component</div>,
}));

vi.mock('../../../store/tree/TreeStoreContext', () => ({
  TreeStoreContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <div data-testid="tree-store-provider">{children}</div>,
  },
}));

describe('ReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewingNodeId = null;
    mockHasReviewContent = false;
    mockReviewStore = null;
    mockPanelPosition = 'side';
  });

  describe('when no review is active', () => {
    it('should show "No active review" message', () => {
      mockReviewingNodeId = null;

      render(<ReviewPanel />);

      expect(screen.getByText('No active review')).toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    });
  });

  describe('when review is active', () => {
    beforeEach(() => {
      mockReviewingNodeId = 'node-123';
      mockReviewStore = { mock: 'store' }; // Mock store object
    });

    it('should render tab bar with buttons', () => {
      render(<ReviewPanel />);

      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByTitle(/Switch to/)).toBeInTheDocument();
    });

    it('should show "Waiting for reviewed content" when no content', () => {
      mockHasReviewContent = false;

      render(<ReviewPanel />);

      expect(screen.getByText('Waiting for reviewed content...')).toBeInTheDocument();
      expect(screen.queryByTestId('tree-component')).not.toBeInTheDocument();
    });

    it('should render Tree component when content is available', () => {
      mockHasReviewContent = true;

      render(<ReviewPanel />);

      expect(screen.getByTestId('tree-store-provider')).toBeInTheDocument();
      expect(screen.getByTestId('tree-component')).toBeInTheDocument();
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
      mockHasReviewContent = false;

      render(<ReviewPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).toBeDisabled();
    });

    it('should enable Accept button when reviewed content is available', () => {
      mockHasReviewContent = true;

      render(<ReviewPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).not.toBeDisabled();
    });

    it('should call handleAccept when Accept clicked', () => {
      mockHasReviewContent = true;

      render(<ReviewPanel />);

      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      expect(mockHandleAccept).toHaveBeenCalledTimes(1);
      expect(mockHandleAccept).toHaveBeenCalledWith();
    });

    it('should have correct CSS classes for buttons', () => {
      render(<ReviewPanel />);

      const cancelButton = screen.getByText('Cancel');
      const acceptButton = screen.getByText('Accept');

      expect(cancelButton).toHaveClass('review-button', 'review-button-cancel');
      expect(acceptButton).toHaveClass('review-button', 'review-button-accept');
    });

    it('should have correct CSS classes for layout', () => {
      const { container } = render(<ReviewPanel />);

      expect(container.querySelector('.review-panel')).toBeInTheDocument();
      expect(container.querySelector('.review-tab-bar')).toBeInTheDocument();
      expect(container.querySelector('.review-content')).toBeInTheDocument();
    });

    it('should show correct toggle button icon for side panel', () => {
      mockPanelPosition = 'side';

      render(<ReviewPanel />);

      const toggleButton = screen.getByTitle('Switch to bottom panel');
      expect(toggleButton).toHaveTextContent('⬇');
    });

    it('should show correct toggle button icon for bottom panel', () => {
      mockPanelPosition = 'bottom';

      render(<ReviewPanel />);

      const toggleButton = screen.getByTitle('Switch to side panel');
      expect(toggleButton).toHaveTextContent('➡');
    });

    it('should call togglePanelPosition when toggle button clicked', () => {
      render(<ReviewPanel />);

      const toggleButton = screen.getByTitle(/Switch to/);
      fireEvent.click(toggleButton);

      expect(mockTogglePanelPosition).toHaveBeenCalledTimes(1);
    });
  });
});
