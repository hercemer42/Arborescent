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
  const decompositionDisabled = recurse && !decomposition;
  const recurseDisabled = decomposition && !recurse;

  return (
    <>
      <div className="step-config-section-label step-config-section-separator">Options</div>
      <label className={`step-config-checkbox-label${decompositionDisabled ? ' step-config-checkbox-label--disabled' : ''}`}>
        <input
          type="checkbox"
          checked={decomposition}
          disabled={decompositionDisabled}
          onChange={(e) => onDecompositionChange(e.target.checked)}
          aria-label="Decomposition"
        />
        Decomposition
      </label>
      <div className="step-config-description">AI response creates multiple sibling nodes instead of replacing the original. Pair with Recurse on a later step to play each sibling forward automatically.</div>
      <label className={`step-config-checkbox-label${recurseDisabled ? ' step-config-checkbox-label--disabled' : ''}`}>
        <input
          type="checkbox"
          checked={recurse}
          disabled={recurseDisabled}
          onChange={(e) => onRecurseChange(e.target.checked)}
          aria-label="Recurse"
        />
        Recurse
      </label>
      <div className="step-config-description">After completing this step, automatically process the next decomposed sibling on the same terminal. Requires Decomposition on a step in this workflow — without it, recurse does nothing.</div>
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
