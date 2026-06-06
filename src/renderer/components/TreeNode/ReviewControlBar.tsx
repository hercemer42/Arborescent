import { useFeedbackActions } from '../Feedback/hooks/useFeedbackActions';
import './ReviewControlBar.css';

// Relocated from the feedback panel's tab bar: accept promotes the proposition onto the
// reviewed node, cancel discards it. Buttons only — no keyboard shortcuts in this context.
export function ReviewControlBar() {
  const { handleAccept, handleCancel } = useFeedbackActions();

  return (
    <div className="review-control-bar" role="group" aria-label="Review proposed changes">
      <button
        type="button"
        className="review-control-button review-control-accept"
        onClick={() => void handleAccept()}
      >
        Accept
      </button>
      <button
        type="button"
        className="review-control-button review-control-cancel"
        onClick={() => void handleCancel()}
      >
        Cancel
      </button>
    </div>
  );
}
