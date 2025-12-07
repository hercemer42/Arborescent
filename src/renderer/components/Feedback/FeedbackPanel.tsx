import { useRef } from 'react';
import { useFeedbackClipboard } from './hooks/useFeedbackClipboard';
import { useFeedbackActions } from './hooks/useFeedbackActions';
import { useFeedbackState } from './hooks/useFeedbackState';
import { useFeedbackKeyboard } from './hooks/useFeedbackKeyboard';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { Tree } from '../Tree';
import { FeedbackTabBar } from './FeedbackTabBar';
import './FeedbackPanel.css';

export function FeedbackPanel() {
  const { collaboratingNodeId, feedbackStore, feedbackVersion } = useFeedbackState();
  const hasFeedbackContent = useFeedbackClipboard(collaboratingNodeId);
  const { handleCancel, handleAccept } = useFeedbackActions();
  const panelRef = useRef<HTMLDivElement>(null);

  useFeedbackKeyboard(panelRef, feedbackStore);

  if (!collaboratingNodeId) {
    return (
      <div className="feedback-panel" ref={panelRef}>
        <div className="feedback-empty">
          No active collaboration
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-panel" ref={panelRef}>
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
            Waiting for feedback to appear in clipboard...
          </div>
        )}
      </div>
    </div>
  );
}
