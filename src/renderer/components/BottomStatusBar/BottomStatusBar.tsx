import { useFlashMessage } from './hooks/useFlashMessage';
import { useFeedbackStatus } from './hooks/useFeedbackStatus';
import './BottomStatusBar.css';

export function BottomStatusBar() {
  const flashMessage = useFlashMessage();
  const statusMessage = useFeedbackStatus();

  // Show flash message if present
  if (flashMessage) {
    return (
      <div className="bottom-status-bar bottom-status-bar-flash">
        <span className="status-message">{flashMessage}</span>
      </div>
    );
  }

  // Show nothing if no collaboration in progress
  if (!statusMessage) {
    return null;
  }

  return (
    <div className="bottom-status-bar">
      <span className="status-message">{statusMessage}</span>
    </div>
  );
}
