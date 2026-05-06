import { useStepConfigDialogStore } from '../../../store/stepConfigDialog/stepConfigDialogStore';
import { useStore } from '../../../store/tree/useStore';
import { useModalHotkeyContext } from '../../../hooks';
import { StepConfigDialog } from './StepConfigDialog';
import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';
import type { ArchiveSettings } from './StepConfigDialog';

export function StepConfigDialogContainer() {
  const isOpen = useStepConfigDialogStore((state) => state.isOpen);
  const nodeId = useStepConfigDialogStore((state) => state.nodeId);
  const close = useStepConfigDialogStore((state) => state.close);

  const node = useStore((state) => (nodeId ? state.nodes[nodeId] : null));
  const currentFilePath = useStore((state) => state.currentFilePath);
  const setStepType = useStore((state) => state.actions.setStepType);
  const setDecomposition = useStore((state) => state.actions.setDecomposition);
  const setRecurse = useStore((state) => state.actions.setRecurse);
  const setClearSession = useStore((state) => state.actions.setClearSession);
  const setArchiveSettings = useStore((state) => state.actions.setArchiveSettings);

  useModalHotkeyContext(isOpen);

  if (!isOpen || !nodeId || !node) {
    return null;
  }

  const currentStepType = (node.metadata.stepType as StepType) || 'manual';
  const decomposition = node.metadata.decomposition === true;
  const recurse = node.metadata.recurse === true;
  const clearSession = node.metadata.clearSession === true;
  const archiveSettings: ArchiveSettings = {
    archiveDestinationId: node.metadata.archiveDestinationId as string | undefined,
    archiveSideLinkName: node.metadata.archiveSideLinkName as string | undefined,
    replacementSideLinkName: node.metadata.replacementSideLinkName as string | undefined,
    resolveLinkedContent: node.metadata.resolveLinkedContent === true,
  };

  return (
    <StepConfigDialog
      nodeId={nodeId}
      currentStepType={currentStepType}
      decomposition={decomposition}
      recurse={recurse}
      clearSession={clearSession}
      archiveSettings={archiveSettings}
      currentFilePath={currentFilePath}
      onStepTypeChange={setStepType}
      onDecompositionChange={setDecomposition}
      onRecurseChange={setRecurse}
      onClearSessionChange={setClearSession}
      onArchiveSettingsChange={setArchiveSettings}
      onClose={close}
    />
  );
}
