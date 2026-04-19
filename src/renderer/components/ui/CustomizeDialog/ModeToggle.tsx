import type { ContextMode } from '../../../store/tree/treeStore';

interface ModeToggleProps {
  selectedMode: ContextMode | null | undefined;
  onModeChange: (mode: ContextMode) => void;
}

/**
 * Optional collaborate/execute toggle — rendered only when the dialog is
 * opened with showModeToggle=true (context-declaration flow).
 */
export function ModeToggle({ selectedMode, onModeChange }: ModeToggleProps) {
  return (
    <div className="icon-picker-mode-section">
      <div className="icon-picker-mode-label">Context mode</div>
      <div className="icon-picker-mode-toggle">
        <button
          className={`icon-picker-mode-option ${selectedMode === 'collaborate' ? 'selected' : ''}`}
          onClick={() => onModeChange('collaborate')}
        >
          Collaborate
        </button>
        <button
          className={`icon-picker-mode-option ${selectedMode === 'execute' ? 'selected' : ''}`}
          onClick={() => onModeChange('execute')}
        >
          Execute
        </button>
      </div>
    </div>
  );
}
