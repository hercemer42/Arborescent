interface StepOptionsSectionProps {
  decomposition: boolean;
  recurse: boolean;
  clearSession: boolean;
  onDecompositionChange: (value: boolean) => void;
  onRecurseChange: (value: boolean) => void;
  onClearSessionChange: (value: boolean) => void;
}

export function StepOptionsSection({
  decomposition,
  recurse,
  clearSession,
  onDecompositionChange,
  onRecurseChange,
  onClearSessionChange,
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
      <label
        className="step-config-checkbox-label"
        title="Sends /clear to the target terminal before this step's prompt. Wipes any unsent input in that terminal."
      >
        <input
          type="checkbox"
          checked={clearSession}
          onChange={(e) => onClearSessionChange(e.target.checked)}
          aria-label="Clear AI session"
        />
        Clear AI session
      </label>
      <div className="step-config-description">Resets the AI session before this step&apos;s prompt is sent. Any unsent input in the target terminal is wiped.</div>
    </>
  );
}
