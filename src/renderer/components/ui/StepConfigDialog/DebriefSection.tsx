import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';
import { useDebriefHyperlinkPaste } from './hooks/useDebriefHyperlinkPaste';

interface DebriefSectionProps {
  stepType: StepType;
  debriefDestinationId?: string;
  onChange: (destinationId: string) => void;
  currentFilePath?: string | null;
  destinationContent?: string;
}

const MANUAL_ROUTE_REASON =
  'Only autonomous steps can write a debrief — on a manual or checkpoint step every tree write becomes a review proposition, which the proposal receiver rejects.';

export function DebriefSection({
  stepType,
  debriefDestinationId = '',
  onChange,
  currentFilePath = null,
  destinationContent,
}: DebriefSectionProps) {
  const { handlePaste, error } = useDebriefHyperlinkPaste(currentFilePath, onChange);

  const isAutonomous = stepType === 'autonomous';

  return (
    <>
      <div className="step-config-section-label step-config-section-separator">Debrief</div>
      <label className="step-config-input-label">
        Findings node
        <input
          type="text"
          className="step-config-text-input"
          placeholder="Paste node hyperlink"
          value={debriefDestinationId}
          readOnly
          disabled={!isAutonomous}
          onPaste={isAutonomous ? handlePaste : undefined}
          aria-label="Findings node"
        />
      </label>
      {!isAutonomous && <div className="step-config-description">{MANUAL_ROUTE_REASON}</div>}
      {isAutonomous && (error ? (
        <div className="step-config-error" role="alert">{error}</div>
      ) : (
        <>
          <div className="step-config-description">
            Copy a node in this file as hyperlink and paste it here. The session writes what it observed as findings beneath it.
          </div>
          {destinationContent && (
            <div className="step-config-description step-config-debrief-target">{destinationContent}</div>
          )}
          {!debriefDestinationId && (
            <div className="step-config-warning">Debrief step without a Findings node — nothing it observes will be recorded.</div>
          )}
        </>
      ))}
    </>
  );
}
