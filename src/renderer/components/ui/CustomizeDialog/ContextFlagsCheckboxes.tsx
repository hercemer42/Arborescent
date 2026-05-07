interface ContextFlagsCheckboxesProps {
  collaborate: boolean;
  execute: boolean;
  onCollaborateChange: (value: boolean) => void;
  onExecuteChange: (value: boolean) => void;
}

export function ContextFlagsCheckboxes({
  collaborate,
  execute,
  onCollaborateChange,
  onExecuteChange,
}: ContextFlagsCheckboxesProps) {
  return (
    <div className="icon-picker-flags-section">
      <div className="icon-picker-flags-default">
        Default: Action — AI responds however the context directs
      </div>
      <div className="icon-picker-flags-prompt">Also ask for:</div>
      <div className="icon-picker-flags-options">
        <label htmlFor="context-flag-collaborate" className="icon-picker-flag-option">
          <input
            id="context-flag-collaborate"
            type="checkbox"
            checked={collaborate}
            onChange={(e) => onCollaborateChange(e.target.checked)}
          />
          <span className="icon-picker-flag-label">
            Collaborate — a reviewable tree update (opens panel)
          </span>
        </label>
        <label htmlFor="context-flag-execute" className="icon-picker-flag-option">
          <input
            id="context-flag-execute"
            type="checkbox"
            checked={execute}
            onChange={(e) => onExecuteChange(e.target.checked)}
          />
          <span className="icon-picker-flag-label">
            Execute — code or file changes in the repo
          </span>
        </label>
      </div>
    </div>
  );
}
