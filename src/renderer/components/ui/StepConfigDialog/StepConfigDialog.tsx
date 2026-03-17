import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';
import { Modal } from '../Modal';
import './StepConfigDialog.css';

const STEP_TYPE_OPTIONS: { value: StepType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'checkpoint', label: 'Checkpoint' },
  { value: 'autonomous', label: 'Autonomous' },
];

const STEP_TYPE_DESCRIPTIONS: Record<StepType, string> = {
  manual: 'Nothing is sent to the terminal. You act manually.',
  checkpoint: 'Content is sent automatically. Pauses for your review before advancing.',
  autonomous: 'Content is sent and advances automatically. Ensure contexts are configured correctly.',
};

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
  const {
    archiveDestinationId = '',
    archiveSideLinkName = '',
    replacementSideLinkName = '',
    resolveLinkedContent = false,
  } = archiveSettings;

  return (
    <Modal title="Step Configuration" width={320} onClose={onClose}>
      <div className="step-config-body">
        <div className="step-config-section-label">Step Type</div>
        <div role="radiogroup" aria-label="Step type">
          {STEP_TYPE_OPTIONS.map(({ value, label }) => (
            <label key={value} className="step-config-radio-label">
              <input
                type="radio"
                name="stepType"
                value={value}
                checked={effectiveStepType === value}
                onChange={() => {
                  if (value !== effectiveStepType) {
                    onStepTypeChange(nodeId, value);
                  }
                }}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="step-config-description">{STEP_TYPE_DESCRIPTIONS[effectiveStepType]}</div>
        <div className="step-config-section-label step-config-section-separator">Options</div>
        <label className="step-config-checkbox-label">
          <input
            type="checkbox"
            checked={decomposition}
            onChange={(e) => onDecompositionChange(nodeId, e.target.checked)}
            aria-label="Decomposition"
          />
          Decomposition
        </label>
        <div className="step-config-description">AI response creates multiple sibling nodes instead of replacing the original.</div>
        <label className="step-config-checkbox-label">
          <input
            type="checkbox"
            checked={recurse}
            onChange={(e) => onRecurseChange(nodeId, e.target.checked)}
            aria-label="Recurse"
          />
          Recurse
        </label>
        <div className="step-config-description">After completing this step, automatically start the next waiting item from the beginning of the automated chain.</div>
        <div className="step-config-section-label step-config-section-separator">Archive</div>
        <label className="step-config-input-label">
          Archive input to
          <input
            type="text"
            className="step-config-text-input"
            placeholder="Paste node hyperlink"
            value={archiveDestinationId}
            onChange={(e) => onArchiveSettingsChange(nodeId, { ...archiveSettings, archiveDestinationId: e.target.value || undefined })}
            aria-label="Archive destination"
          />
        </label>
        <div className="step-config-description">Copy a node as hyperlink and paste its ID here. The original will be moved there before replacement.</div>
        {archiveDestinationId && (
          <>
            <label className="step-config-input-label">
              Archive-side link name
              <input
                type="text"
                className="step-config-text-input"
                placeholder="e.g. Output"
                value={archiveSideLinkName}
                onChange={(e) => onArchiveSettingsChange(nodeId, { ...archiveSettings, archiveSideLinkName: e.target.value || undefined })}
                aria-label="Archive-side link name"
              />
            </label>
            <label className="step-config-input-label">
              Replacement-side link name
              <input
                type="text"
                className="step-config-text-input"
                placeholder="e.g. Source"
                value={replacementSideLinkName}
                onChange={(e) => onArchiveSettingsChange(nodeId, { ...archiveSettings, replacementSideLinkName: e.target.value || undefined })}
                aria-label="Replacement-side link name"
              />
            </label>
            <label className="step-config-checkbox-label">
              <input
                type="checkbox"
                checked={resolveLinkedContent}
                onChange={(e) => onArchiveSettingsChange(nodeId, { ...archiveSettings, resolveLinkedContent: e.target.checked })}
                aria-label="Resolve linked content when sending"
              />
              Resolve linked content when sending
            </label>
            <div className="step-config-description">Include the archived original content in AI prompts when sending a replacement.</div>
          </>
        )}
        {effectiveStepType === 'autonomous' && !archiveDestinationId && (
          <div className="step-config-warning">Autonomous step without archive — original content will be lost on replacement.</div>
        )}
      </div>
    </Modal>
  );
}
