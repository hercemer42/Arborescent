import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';
import { Modal } from '../Modal';
import { StepTypeSelector } from './StepTypeSelector';
import { StepOptionsSection } from './StepOptionsSection';
// TODO(archive): Archive UI disabled 2026-06-08. Either restore it (uncomment
// this import and the <ArchiveSection> render below) or delete the archive
// feature entirely (ArchiveSection, useArchiveHyperlinkPaste, getArchiveConfigForNode,
// AcceptFeedbackCommand's archive path, and the archive* NodeMetadata fields).
// The underlying command/store machinery is left intact and dormant for now.
// import { ArchiveSection } from './ArchiveSection';
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
  clearSession?: boolean;
  archiveSettings?: ArchiveSettings;
  currentFilePath?: string | null;
  onStepTypeChange: (nodeId: string, stepType: StepType) => void;
  onDecompositionChange: (nodeId: string, decomposition: boolean) => void;
  onRecurseChange: (nodeId: string, recurse: boolean) => void;
  onClearSessionChange: (nodeId: string, clearSession: boolean) => void;
  onArchiveSettingsChange: (nodeId: string, settings: ArchiveSettings) => void;
  onClose: () => void;
}

export function StepConfigDialog({
  nodeId,
  currentStepType,
  decomposition = false,
  recurse = false,
  clearSession = false,
  // TODO(archive): archiveSettings / currentFilePath / onArchiveSettingsChange
  // remain on the props interface (and are still passed by the container) so
  // restoring the archive section is a one-line uncomment. They're intentionally
  // not destructured while the section is disabled.
  onStepTypeChange,
  onDecompositionChange,
  onRecurseChange,
  onClearSessionChange,
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
          clearSession={clearSession}
          onDecompositionChange={(v) => onDecompositionChange(nodeId, v)}
          onRecurseChange={(v) => onRecurseChange(nodeId, v)}
          onClearSessionChange={(v) => onClearSessionChange(nodeId, v)}
        />
        {/* TODO(archive): Archive section disabled 2026-06-08 — restore or delete (see import note above).
        <ArchiveSection
          stepType={effectiveStepType}
          archiveSettings={archiveSettings}
          currentFilePath={currentFilePath}
          onChange={(settings) => onArchiveSettingsChange(nodeId, settings)}
        /> */}
      </div>
    </Modal>
  );
}
