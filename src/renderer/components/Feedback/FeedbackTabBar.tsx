import { usePanelStore } from '../../store/panel/panelStore';

interface FeedbackTabBarProps {
  hasFeedbackContent: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function FeedbackTabBar({ hasFeedbackContent, onAccept, onCancel }: FeedbackTabBarProps) {
  const panelPosition = usePanelStore((state) => state.panelPosition);
  const togglePanelPosition = usePanelStore((state) => state.togglePanelPosition);

  return (
    <div className="feedback-tab-bar">
      <div className="feedback-actions-left">
        <button
          className="feedback-button feedback-button-accept"
          onClick={onAccept}
          disabled={!hasFeedbackContent}
          title="Accept feedback"
        >
          Accept
        </button>
        <button
          className="feedback-button feedback-button-cancel"
          onClick={onCancel}
          title="Cancel collaboration"
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
