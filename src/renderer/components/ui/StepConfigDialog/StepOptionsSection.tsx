interface StepOptionsSectionProps {
  decomposition: boolean;
  recurse: boolean;
  onDecompositionChange: (value: boolean) => void;
  onRecurseChange: (value: boolean) => void;
}

export function StepOptionsSection({
  decomposition,
  recurse,
  onDecompositionChange,
  onRecurseChange,
}: StepOptionsSectionProps) {
  return (
    <>
      <div className="step-config-section-label step-config-section-separator">Options</div>
      <label className="step-config-checkbox-label">
        <input
          type="checkbox"
          checked={decomposition}
          onChange={(e) => onDecompositionChange(e.target.checked)}
          aria-label="Decomposition"
        />
        Decomposition
      </label>
      <div className="step-config-description">AI response creates multiple sibling nodes instead of replacing the original.</div>
      <label className="step-config-checkbox-label">
        <input
          type="checkbox"
          checked={recurse}
          onChange={(e) => onRecurseChange(e.target.checked)}
          aria-label="Recurse"
        />
        Recurse
      </label>
      <div className="step-config-description">After completing this step, automatically start the next waiting item from the beginning of the automated chain.</div>
    </>
  );
}
