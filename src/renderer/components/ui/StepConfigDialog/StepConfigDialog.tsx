import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';
import { Modal } from '../Modal';
import { StepTypeSelector } from './StepTypeSelector';
import { StepOptionsSection } from './StepOptionsSection';
import { ArchiveSection } from './ArchiveSection';
import './StepConfigDialog.css';

export interface ArchiveSettings {
  archiveDestinationId?: string;
  archiveSideLinkName?: string;
  replacementSideLinkName?: string;
  resolveLinkedContent?: boolean;
}

interface StepConfigDialogProps {
  nodeId: string;
  currentStepType: StepType;
  decomposition?: boolean;
  recurse?: boolean;
  archiveSettings?: ArchiveSettings;
  onStepTypeChange: (nodeId: string, stepType: StepType) => void;
  onDecompositionChange: (nodeId: string, decomposition: boolean) => void;
  onRecurseChange: (nodeId: string, recurse: boolean) => void;
  onArchiveSettingsChange: (nodeId: string, settings: ArchiveSettings) => void;
  onClose: () => void;
}

export function StepConfigDialog({
  nodeId,
  currentStepType,
  decomposition = false,
  recurse = false,
  archiveSettings = {},
  onStepTypeChange,
  onDecompositionChange,
  onRecurseChange,
  onArchiveSettingsChange,
  onClose,
}: StepConfigDialogProps) {
  const effectiveStepType = currentStepType || 'manual';

  return (
    <Modal title="Step Configuration" width={320} onClose={onClose}>
      <div className="step-config-body">
        <StepTypeSelector
          selected={effectiveStepType}
          onChange={(stepType) => onStepTypeChange(nodeId, stepType)}
        />
        <StepOptionsSection
          decomposition={decomposition}
          recurse={recurse}
          onDecompositionChange={(v) => onDecompositionChange(nodeId, v)}
          onRecurseChange={(v) => onRecurseChange(nodeId, v)}
        />
        <ArchiveSection
          stepType={effectiveStepType}
          archiveSettings={archiveSettings}
          onChange={(settings) => onArchiveSettingsChange(nodeId, settings)}
        />
      </div>
    </Modal>
  );
}
