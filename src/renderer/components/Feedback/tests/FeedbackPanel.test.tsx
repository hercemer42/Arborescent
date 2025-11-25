import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackPanel } from '../FeedbackPanel';

const mockHandleCancel = vi.fn();
const mockHandleAccept = vi.fn();
let mockCollaboratingNodeId: string | null = null;
let mockHasFeedbackContent = false;
let mockFeedbackStore: unknown = null;
let mockPanelPosition: 'side' | 'bottom' = 'side';
const mockTogglePanelPosition = vi.fn();

vi.mock('../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(() => ({
      subscribe: vi.fn(() => () => {}),
      getState: vi.fn(() => ({
        collaboratingNodeId: mockCollaboratingNodeId,
        nodes: {},
      })),
    })),
  },
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

vi.mock('../hooks/useFeedbackClipboard', () => ({
  useFeedbackClipboard: vi.fn(() => mockHasFeedbackContent),
}));

vi.mock('../hooks/useFeedbackActions', () => ({
  useFeedbackActions: vi.fn(() => ({
    handleCancel: mockHandleCancel,
    handleAccept: mockHandleAccept,
  })),
}));

vi.mock('../../../store/feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForFile: vi.fn(() => mockFeedbackStore),
  },
}));

vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn((selector) => {
    const mockState = {
      activeFilePath: '/test/file.arbo',
    };
    return selector(mockState);
  }),
}));

vi.mock('../../Tree', () => ({
  Tree: () => <div data-testid="tree-component">Tree Component</div>,
}));

vi.mock('../../../store/tree/TreeStoreContext', () => ({
  TreeStoreContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <div data-testid="tree-store-provider">{children}</div>,
  },
}));

describe('FeedbackPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollaboratingNodeId = null;
    mockHasFeedbackContent = false;
    mockFeedbackStore = null;
    mockPanelPosition = 'side';
  });

  describe('when no collaboration is active', () => {
    it('should show "No active collaboration" message', () => {
      mockCollaboratingNodeId = null;

      render(<FeedbackPanel />);

      expect(screen.getByText('No active collaboration')).toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    });
  });

  describe('when collaboration is active', () => {
    beforeEach(() => {
      mockCollaboratingNodeId = 'node-123';
      mockFeedbackStore = { mock: 'store' }; // Mock store object
    });

    it('should render tab bar with buttons', () => {
      render(<FeedbackPanel />);

      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByTitle(/Switch to/)).toBeInTheDocument();
    });

    it('should show "Waiting for feedback content" when no content', () => {
      mockHasFeedbackContent = false;

      render(<FeedbackPanel />);

      expect(screen.getByText('Waiting for feedback to appear in clipboard...')).toBeInTheDocument();
      expect(screen.queryByTestId('tree-component')).not.toBeInTheDocument();
    });

    it('should render Tree component when content is available', () => {
      mockHasFeedbackContent = true;

      render(<FeedbackPanel />);

      expect(screen.getByTestId('tree-store-provider')).toBeInTheDocument();
      expect(screen.getByTestId('tree-component')).toBeInTheDocument();
      expect(screen.queryByText('Waiting for feedback to appear in clipboard...')).not.toBeInTheDocument();
    });

    it('should render Cancel button that calls handleCancel', () => {
      render(<FeedbackPanel />);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeInTheDocument();

      fireEvent.click(cancelButton);

      expect(mockHandleCancel).toHaveBeenCalledTimes(1);
    });

    it('should render Accept button', () => {
      render(<FeedbackPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).toBeInTheDocument();
    });

    it('should disable Accept button when no feedback content', () => {
      mockHasFeedbackContent = false;

      render(<FeedbackPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).toBeDisabled();
    });

    it('should enable Accept button when feedback content is available', () => {
      mockHasFeedbackContent = true;

      render(<FeedbackPanel />);

      const acceptButton = screen.getByText('Accept');
      expect(acceptButton).not.toBeDisabled();
    });

    it('should call handleAccept when Accept clicked', () => {
      mockHasFeedbackContent = true;

      render(<FeedbackPanel />);

      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      expect(mockHandleAccept).toHaveBeenCalledTimes(1);
      expect(mockHandleAccept).toHaveBeenCalledWith();
    });

    it('should have correct CSS classes for buttons', () => {
      render(<FeedbackPanel />);

      const cancelButton = screen.getByText('Cancel');
      const acceptButton = screen.getByText('Accept');

      expect(cancelButton).toHaveClass('feedback-button', 'feedback-button-cancel');
      expect(acceptButton).toHaveClass('feedback-button', 'feedback-button-accept');
    });

    it('should have correct CSS classes for layout', () => {
      const { container } = render(<FeedbackPanel />);

      expect(container.querySelector('.feedback-panel')).toBeInTheDocument();
      expect(container.querySelector('.feedback-tab-bar')).toBeInTheDocument();
      expect(container.querySelector('.feedback-content')).toBeInTheDocument();
    });

    it('should show correct toggle button icon for side panel', () => {
      mockPanelPosition = 'side';

      render(<FeedbackPanel />);

      const toggleButton = screen.getByTitle('Switch to bottom panel');
      expect(toggleButton).toHaveTextContent('⬇');
    });

    it('should show correct toggle button icon for bottom panel', () => {
      mockPanelPosition = 'bottom';

      render(<FeedbackPanel />);

      const toggleButton = screen.getByTitle('Switch to side panel');
      expect(toggleButton).toHaveTextContent('➡');
    });

    it('should call togglePanelPosition when toggle button clicked', () => {
      render(<FeedbackPanel />);

      const toggleButton = screen.getByTitle(/Switch to/);
      fireEvent.click(toggleButton);

      expect(mockTogglePanelPosition).toHaveBeenCalledTimes(1);
    });
  });
});
