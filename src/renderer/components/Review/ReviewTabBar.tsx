import { usePanelStore } from '../../store/panel/panelStore';

interface ReviewTabBarProps {
  hasReviewContent: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function ReviewTabBar({ hasReviewContent, onAccept, onCancel }: ReviewTabBarProps) {
  const panelPosition = usePanelStore((state) => state.panelPosition);
  const togglePanelPosition = usePanelStore((state) => state.togglePanelPosition);

  return (
    <div className="review-tab-bar">
      <div className="review-actions-left">
        <button
          className="review-button review-button-accept"
          onClick={onAccept}
          disabled={!hasReviewContent}
          title="Accept reviewed changes"
        >
          Accept
        </button>
        <button
          className="review-button review-button-cancel"
          onClick={onCancel}
          title="Cancel review"
        >
          Cancel
        </button>
      </div>
      <button
        onClick={togglePanelPosition}
        className="toggle-panel-button"
        title={`Switch to ${panelPosition === 'side' ? 'bottom' : 'side'} panel`}
      >
        {panelPosition === 'side' ? '⬇' : '➡'}
      </button>
    </div>
  );
}
