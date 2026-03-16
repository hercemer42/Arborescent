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

interface StepConfigDialogProps {
  nodeId: string;
  currentStepType: StepType;
  decomposition?: boolean;
  onStepTypeChange: (nodeId: string, stepType: StepType) => void;
  onDecompositionChange: (nodeId: string, decomposition: boolean) => void;
  onClose: () => void;
}

export function StepConfigDialog({
  nodeId,
  currentStepType,
  decomposition = false,
  onStepTypeChange,
  onDecompositionChange,
  onClose,
}: StepConfigDialogProps) {
  const effectiveStepType = currentStepType || 'manual';

  return (
    <Modal title="Step Configuration" width={280} onClose={onClose}>
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
      </div>
    </Modal>
  );
}
