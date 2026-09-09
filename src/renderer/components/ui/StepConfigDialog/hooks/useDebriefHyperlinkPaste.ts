import { useCallback, useState } from 'react';
import { useHyperlinkClipboardStore } from '../../../../store/clipboard/hyperlinkClipboardStore';

const NO_HYPERLINK = 'Copy a node as hyperlink first, then paste it here.';
const STALE_CLIPBOARD = 'The clipboard changed since that node was copied — copy it again.';
const FOREIGN_FILE = 'The Findings node must live in this file.';

interface DebriefHyperlinkPaste {
  handlePaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  error: string | null;
}

// Every refusal is announced rather than swallowed: a destination that does not
// resolve at send time costs the session its whole debrief, so a paste that
// cannot work must never look like one that did.
export function useDebriefHyperlinkPaste(
  currentFilePath: string | null,
  onChange: (destinationId: string) => void,
): DebriefHyperlinkPaste {
  const [error, setError] = useState<string | null>(null);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();

    const cache = useHyperlinkClipboardStore.getState().getCache();
    if (!cache) {
      setError(NO_HYPERLINK);
      return;
    }

    if (event.clipboardData.getData('text/plain') !== cache.clipboardTextAtCopy) {
      useHyperlinkClipboardStore.getState().clearCache();
      setError(STALE_CLIPBOARD);
      return;
    }

    if (!currentFilePath || cache.sourceFilePath !== currentFilePath) {
      setError(FOREIGN_FILE);
      return;
    }

    setError(null);
    onChange(cache.nodeId);
    useHyperlinkClipboardStore.getState().clearCache();
  }, [currentFilePath, onChange]);

  return { handlePaste, error };
}
