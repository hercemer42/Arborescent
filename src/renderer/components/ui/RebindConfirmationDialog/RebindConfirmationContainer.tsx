import { useRebindConfirmation } from './hooks/useRebindConfirmation';
import { RebindConfirmationDialog } from './RebindConfirmationDialog';

export function RebindConfirmationContainer() {
  const state = useRebindConfirmation();
  if (state.pendingRequest === null) return null;

  return (
    <RebindConfirmationDialog
      previousNodeLabel={state.previousLabel}
      newNodeLabel={state.newLabel}
      onConfirm={state.onConfirm}
      onCancel={state.onCancel}
    />
  );
}
