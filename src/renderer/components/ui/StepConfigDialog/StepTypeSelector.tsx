import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';

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

interface StepTypeSelectorProps {
  selected: StepType;
  onChange: (value: StepType) => void;
}

export function StepTypeSelector({ selected, onChange }: StepTypeSelectorProps) {
  return (
    <>
      <div className="step-config-section-label">Step Type</div>
      <div role="radiogroup" aria-label="Step type">
        {STEP_TYPE_OPTIONS.map(({ value, label }) => (
          <label key={value} className="step-config-radio-label">
            <input
              type="radio"
              name="stepType"
              value={value}
              checked={selected === value}
              onChange={() => {
                if (value !== selected) {
                  onChange(value);
                }
              }}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="step-config-description">{STEP_TYPE_DESCRIPTIONS[selected]}</div>
    </>
  );
}
