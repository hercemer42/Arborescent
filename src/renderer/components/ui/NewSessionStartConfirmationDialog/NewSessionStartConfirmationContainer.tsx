import { usePendingNewSessionStartStore } from '../../../store/pendingNewSessionStartStore';
import { NewSessionStartConfirmationDialog } from './NewSessionStartConfirmationDialog';

export function NewSessionStartConfirmationContainer() {
  const pending = usePendingNewSessionStartStore((state) => state.current);
  if (!pending) return null;

  return (
    <NewSessionStartConfirmationDialog
      onConfirm={() => void pending.onConfirm()}
      onCancel={pending.onCancel}
    />
  );
}
