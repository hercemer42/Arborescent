import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';
import { Modal } from '../Modal';
import './StepConfigDialog.css';

const STEP_TYPE_OPTIONS: { value: StepType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'checkpoint', label: 'Checkpoint' },
  { value: 'autonomous', label: 'Autonomous' },
];

interface StepConfigDialogProps {
  nodeId: string;
  currentStepType: StepType;
  onStepTypeChange: (nodeId: string, stepType: StepType) => void;
  onClose: () => void;
}

export function StepConfigDialog({
  nodeId,
  currentStepType,
  onStepTypeChange,
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
      </div>
    </Modal>
  );
}
