import { useEffect } from 'react';
import { useFeedbackClipboard } from './hooks/useFeedbackClipboard';
import { useFeedbackActions } from './hooks/useFeedbackActions';
import { useFeedbackState } from './hooks/useFeedbackState';
import { setActiveFeedbackStore } from '../../services/keyboard/shared';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { Tree } from '../Tree';
import { FeedbackTabBar } from './FeedbackTabBar';
import { ProposalList } from './ProposalList';
import { useFilesStore } from '../../store/files/filesStore';
import { useProposalsStore } from '../../store/proposals/proposalsStore';
import { resolveToSourceFilePath } from '../../utils/zoomPath';
import './FeedbackPanel.css';

export function FeedbackPanel() {
  const { collaboratingNodeId, feedbackStore, feedbackVersion } = useFeedbackState();
  const hasFeedbackContent = useFeedbackClipboard(collaboratingNodeId);
  const { handleCancel, handleAccept } = useFeedbackActions();
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const sourceFilePath = resolveToSourceFilePath(activeFilePath);
  const hasProposals = useProposalsStore((s) =>
    sourceFilePath ? (s.proposalsByFile[sourceFilePath] ?? []).length > 0 : false,
  );

  useEffect(() => {
    setActiveFeedbackStore(feedbackStore ?? null);
    return () => setActiveFeedbackStore(null);
  }, [feedbackStore]);

  if (!collaboratingNodeId && !hasProposals) {
    return (
      <div className="feedback-panel">
        <div className="feedback-empty">
          No active collaboration
        </div>
      </div>
    );
  }

  if (!collaboratingNodeId) {
    return (
      <div className="feedback-panel">
        <ProposalList />
      </div>
    );
  }

  return (
    <div className="feedback-panel">
      <ProposalList />
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
