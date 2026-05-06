import { useCallback } from 'react';
import { useHyperlinkClipboardStore } from '../../../../store/clipboard/hyperlinkClipboardStore';
import type { ArchiveSettings } from '../StepConfigDialog';

export function useArchiveHyperlinkPaste(
  archiveSettings: ArchiveSettings,
  currentFilePath: string | null,
  onChange: (settings: ArchiveSettings) => void
) {
  return useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    const cache = useHyperlinkClipboardStore.getState().getCache();
    if (!cache) return;

    const clipboardText = event.clipboardData.getData('text/plain');
    if (clipboardText !== cache.clipboardTextAtCopy) {
      useHyperlinkClipboardStore.getState().clearCache();
      return;
    }

    if (!currentFilePath || cache.sourceFilePath !== currentFilePath) return;

    event.preventDefault();
    onChange({ ...archiveSettings, archiveDestinationId: cache.nodeId });
    useHyperlinkClipboardStore.getState().clearCache();
  }, [archiveSettings, currentFilePath, onChange]);
}
