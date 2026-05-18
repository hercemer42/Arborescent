import { useEffect } from 'react';
import { useFeedbackClipboard } from './hooks/useFeedbackClipboard';
import { useFeedbackActions } from './hooks/useFeedbackActions';
import { useFeedbackState } from './hooks/useFeedbackState';
import { setActiveFeedbackStore } from '../../services/keyboard/shared';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { Tree } from '../Tree';
import { FeedbackTabBar } from './FeedbackTabBar';
import './FeedbackPanel.css';

export function FeedbackPanel() {
  const { collaboratingNodeId, feedbackStore, feedbackVersion } = useFeedbackState();
  const hasFeedbackContent = useFeedbackClipboard(collaboratingNodeId);
  const { handleCancel, handleAccept } = useFeedbackActions();

  useEffect(() => {
    setActiveFeedbackStore(feedbackStore ?? null);
    return () => setActiveFeedbackStore(null);
  }, [feedbackStore]);

  if (!collaboratingNodeId) {
    return (
      <div className="feedback-panel">
        <div className="feedback-empty">
          No active collaboration
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-panel">
      <FeedbackTabBar
        hasFeedbackContent={hasFeedbackContent}
        onAccept={() => handleAccept()}
        onCancel={() => handleCancel()}
      />

      <div className="feedback-content">
        {hasFeedbackContent && feedbackStore ? (
          <TreeStoreContext.Provider value={feedbackStore}>
            <Tree key={feedbackVersion} />
          </TreeStoreContext.Provider>
        ) : (
          <div className="feedback-waiting">
            Waiting for AI response...
          </div>
        )}
      </div>
    </div>
  );
}
