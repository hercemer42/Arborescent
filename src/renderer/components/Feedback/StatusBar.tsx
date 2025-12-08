import { useStore } from '../../store/tree/useStore';
import { useFeedbackClipboard } from './hooks/useFeedbackClipboard';
import './StatusBar.css';

export function StatusBar() {
  const collaboratingNodeId = useStore((state) => state.collaboratingNodeId);
  // Only subscribe to the specific collaborating node's content, not all nodes
  const nodeContent = useStore((state) =>
    state.collaboratingNodeId ? state.nodes[state.collaboratingNodeId]?.content : null
  );
  const hasFeedbackContent = useFeedbackClipboard(collaboratingNodeId);

  if (!collaboratingNodeId || nodeContent === null) {
    return null;
  }

  // Truncate node name to 15 characters
  const maxLength = 15;
  const nodeName = nodeContent.length > maxLength
    ? nodeContent.substring(0, maxLength) + '...'
    : nodeContent;

  // Show different messages based on state
  const statusMessage = hasFeedbackContent
    ? `Collaboration in progress for node ${nodeName}`
    : `Waiting for feedback for node ${nodeName}`;

  return (
    <div className="feedback-status-bar">
      <span className="feedback-status-message">{statusMessage}</span>
    </div>
  );
}
