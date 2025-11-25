import { useStore } from '../../store/tree/useStore';
import { useFeedbackClipboard } from './hooks/useFeedbackClipboard';
import './StatusBar.css';

export function StatusBar() {
  const collaboratingNodeId = useStore((state) => state.collaboratingNodeId);
  const nodes = useStore((state) => state.nodes);
  const hasFeedbackContent = useFeedbackClipboard(collaboratingNodeId);

  if (!collaboratingNodeId) {
    return null;
  }

  const node = nodes[collaboratingNodeId];
  if (!node) {
    return null;
  }

  // Truncate node name to 15 characters
  const maxLength = 15;
  const nodeName = node.content.length > maxLength
    ? node.content.substring(0, maxLength) + '...'
    : node.content;

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
