import { useStepConfigDialogStore } from '../../../store/stepConfigDialog/stepConfigDialogStore';
import { useStore } from '../../../store/tree/useStore';
import { useModalHotkeyContext } from '../../../hooks';
import { StepConfigDialog } from './StepConfigDialog';
import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';

export function StepConfigDialogContainer() {
  const isOpen = useStepConfigDialogStore((state) => state.isOpen);
  const nodeId = useStepConfigDialogStore((state) => state.nodeId);
  const close = useStepConfigDialogStore((state) => state.close);

  const node = useStore((state) => (nodeId ? state.nodes[nodeId] : null));
  const setStepType = useStore((state) => state.actions.setStepType);
  const setDecomposition = useStore((state) => state.actions.setDecomposition);

  useModalHotkeyContext(isOpen);

  if (!isOpen || !nodeId || !node) {
    return null;
  }

  const currentStepType = (node.metadata.stepType as StepType) || 'manual';
  const decomposition = node.metadata.decomposition === true;

  return (
    <StepConfigDialog
      nodeId={nodeId}
      currentStepType={currentStepType}
      decomposition={decomposition}
      onStepTypeChange={setStepType}
      onDecompositionChange={setDecomposition}
      onClose={close}
    />
  );
}
