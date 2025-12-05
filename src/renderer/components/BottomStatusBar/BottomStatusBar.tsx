import { useFlashMessage } from './hooks/useFlashMessage';
import { useFeedbackStatus } from './hooks/useFeedbackStatus';
import { useBlueprintModeStatus } from './hooks/useBlueprintModeStatus';
import './BottomStatusBar.css';

type StatusType = 'flash' | 'blueprint' | 'default';

function useStatusBar(): { message: string; type: StatusType } | null {
  const flashMessage = useFlashMessage();
  const feedbackMessage = useFeedbackStatus();
  const blueprintModeEnabled = useBlueprintModeStatus();

  if (flashMessage) {
    return { message: flashMessage, type: 'flash' };
  }
  if (blueprintModeEnabled) {
    return { message: 'Blueprint Mode', type: 'blueprint' };
  }
  if (feedbackMessage) {
    return { message: feedbackMessage, type: 'default' };
  }
  return null;
}

const STATUS_CLASS_MAP: Record<StatusType, string> = {
  flash: 'bottom-status-bar-flash',
  blueprint: 'bottom-status-bar-blueprint',
  default: '',
};

export function BottomStatusBar() {
  const status = useStatusBar();

  const className = status
    ? `bottom-status-bar ${STATUS_CLASS_MAP[status.type]}`.trim()
    : 'bottom-status-bar';

  return (
    <div className={className}>
      {status && <span className="status-message">{status.message}</span>}
    </div>
  );
}
