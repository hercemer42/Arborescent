import { usePendingTerminalCloseStore } from '../../../store/pendingTerminalCloseStore';
import { TerminalCloseConfirmationDialog } from './TerminalCloseConfirmationDialog';

export function TerminalCloseConfirmationContainer() {
  const pending = usePendingTerminalCloseStore((state) => state.current);
  if (!pending) return null;

  return (
    <TerminalCloseConfirmationDialog
      terminalTitle={pending.terminalTitle}
      onConfirm={() => void pending.onConfirm()}
      onCancel={pending.onCancel}
    />
  );
}
