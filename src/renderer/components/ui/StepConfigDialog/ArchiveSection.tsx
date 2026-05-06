import type { StepType } from '../../../store/tree/commands/SetStepTypeCommand';
import type { ArchiveSettings } from './StepConfigDialog';
import { useArchiveHyperlinkPaste } from './hooks/useArchiveHyperlinkPaste';

interface ArchiveSectionProps {
  stepType: StepType;
  archiveSettings: ArchiveSettings;
  onChange: (settings: ArchiveSettings) => void;
  currentFilePath?: string | null;
}

export function ArchiveSection({ stepType, archiveSettings, onChange, currentFilePath = null }: ArchiveSectionProps) {
  const {
    archiveDestinationId = '',
    archiveSideLinkName = '',
    replacementSideLinkName = '',
    resolveLinkedContent = false,
  } = archiveSettings;

  const handleHyperlinkPaste = useArchiveHyperlinkPaste(archiveSettings, currentFilePath, onChange);

  return (
    <>
      <div className="step-config-section-label step-config-section-separator">Archive</div>
      <label className="step-config-input-label">
        Archive input to
        <input
          type="text"
          className="step-config-text-input"
          placeholder="Paste node hyperlink"
          value={archiveDestinationId}
          onChange={(e) => onChange({ ...archiveSettings, archiveDestinationId: e.target.value || undefined })}
          onPaste={handleHyperlinkPaste}
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
              onChange={(e) => onChange({ ...archiveSettings, archiveSideLinkName: e.target.value || undefined })}
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
              onChange={(e) => onChange({ ...archiveSettings, replacementSideLinkName: e.target.value || undefined })}
              aria-label="Replacement-side link name"
            />
          </label>
          <label className="step-config-checkbox-label">
            <input
              type="checkbox"
              checked={resolveLinkedContent}
              onChange={(e) => onChange({ ...archiveSettings, resolveLinkedContent: e.target.checked })}
              aria-label="Resolve linked content when sending"
            />
            Resolve linked content when sending
          </label>
          <div className="step-config-description">Include the archived original content in AI prompts when sending a replacement.</div>
        </>
      )}
      {stepType === 'autonomous' && !archiveDestinationId && (
        <div className="step-config-warning">Autonomous step without archive — original content will be lost on replacement.</div>
      )}
    </>
  );
}
