import { writeToClipboard } from './clipboardService';
import { logger } from './logger';

export async function copySelectionText(text: string): Promise<void> {
  if (!text) return;
  await writeToClipboard(text, 'partial-text-copy');
}

export async function cutSelectionFromNodeContent(
  selectionText: string,
  nodeContent: string,
  applyContent: (newContent: string) => void
): Promise<void> {
  if (!selectionText) return;

  const idx = nodeContent.indexOf(selectionText);
  if (idx === -1) {
    logger.warn(
      'Partial cut: selection text not found in node source — keeping content unchanged',
      'PartialTextClipboard'
    );
    await writeToClipboard(selectionText, 'partial-text-cut-no-source-match');
    return;
  }

  const newContent = nodeContent.slice(0, idx) + nodeContent.slice(idx + selectionText.length);
  await writeToClipboard(selectionText, 'partial-text-cut');
  applyContent(newContent);
}
