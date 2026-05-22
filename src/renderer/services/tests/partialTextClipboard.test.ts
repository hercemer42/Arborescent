import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copySelectionText, cutSelectionFromNodeContent } from '../partialTextClipboard';

const mockWriteToClipboard = vi.fn();

vi.mock('../clipboardService', () => ({
  writeToClipboard: (text: string, context: string) => mockWriteToClipboard(text, context),
}));

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('partialTextClipboard', () => {
  beforeEach(() => {
    mockWriteToClipboard.mockReset();
    mockWriteToClipboard.mockResolvedValue(true);
  });

  describe('copySelectionText', () => {
    it('writes the selection text to the clipboard', async () => {
      await copySelectionText('hello');
      expect(mockWriteToClipboard).toHaveBeenCalledWith('hello', 'partial-text-copy');
    });

    it('does nothing when given an empty string', async () => {
      await copySelectionText('');
      expect(mockWriteToClipboard).not.toHaveBeenCalled();
    });
  });

  describe('cutSelectionFromNodeContent', () => {
    it('writes the selection to the clipboard and applies the new content with the substring removed', async () => {
      const applyContent = vi.fn();
      await cutSelectionFromNodeContent('world', 'hello world!', applyContent);

      expect(mockWriteToClipboard).toHaveBeenCalledWith('world', 'partial-text-cut');
      expect(applyContent).toHaveBeenCalledWith('hello !');
    });

    it('removes only the first occurrence when the selection text appears multiple times', async () => {
      const applyContent = vi.fn();
      await cutSelectionFromNodeContent('foo', 'foo bar foo', applyContent);

      expect(applyContent).toHaveBeenCalledWith(' bar foo');
    });

    it('writes the selection to the clipboard but does NOT mutate content when the selection is not found in the source', async () => {
      const applyContent = vi.fn();
      await cutSelectionFromNodeContent('missing', 'hello world', applyContent);

      expect(mockWriteToClipboard).toHaveBeenCalledWith('missing', 'partial-text-cut-no-source-match');
      expect(applyContent).not.toHaveBeenCalled();
    });

    it('does nothing when given an empty selection', async () => {
      const applyContent = vi.fn();
      await cutSelectionFromNodeContent('', 'hello world', applyContent);

      expect(mockWriteToClipboard).not.toHaveBeenCalled();
      expect(applyContent).not.toHaveBeenCalled();
    });

    it('handles selection at the start of the source', async () => {
      const applyContent = vi.fn();
      await cutSelectionFromNodeContent('hello ', 'hello world', applyContent);

      expect(applyContent).toHaveBeenCalledWith('world');
    });

    it('handles selection at the end of the source', async () => {
      const applyContent = vi.fn();
      await cutSelectionFromNodeContent(' world', 'hello world', applyContent);

      expect(applyContent).toHaveBeenCalledWith('hello');
    });

    it('handles a selection that is the entire source', async () => {
      const applyContent = vi.fn();
      await cutSelectionFromNodeContent('hello world', 'hello world', applyContent);

      expect(applyContent).toHaveBeenCalledWith('');
    });
  });
});
