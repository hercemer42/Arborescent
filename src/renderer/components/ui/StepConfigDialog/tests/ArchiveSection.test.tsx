import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArchiveSection } from '../ArchiveSection';
import { useHyperlinkClipboardStore } from '@/store/clipboard/hyperlinkClipboardStore';

type ArchiveSectionProps = React.ComponentProps<typeof ArchiveSection>;

function renderArchiveSection(overrides: Partial<ArchiveSectionProps> = {}) {
  const onChange = vi.fn();
  const props: ArchiveSectionProps = {
    stepType: 'manual',
    archiveSettings: {},
    currentFilePath: '/file.arbo',
    onChange,
    ...overrides,
  };
  const utils = render(<ArchiveSection {...props} />);
  return { ...utils, onChange };
}

function fireSyntheticPaste(input: HTMLElement, text: string) {
  fireEvent.paste(input, {
    clipboardData: { getData: (type: string) => (type === 'text/plain' ? text : '') },
  } as unknown as ClipboardEventInit);
}

describe('ArchiveSection hyperlink paste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHyperlinkClipboardStore.setState({ cache: null });
  });

  describe('happy path', () => {
    it('injects cached nodeId into destination input when cache and clipboard guard match', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Some content', '/file.arbo', 'pasted-text');
      const { onChange } = renderArchiveSection();

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ archiveDestinationId: 'node-42' }));
    });

    it('clears the hyperlink cache after a successful injection', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Some content', '/file.arbo', 'pasted-text');
      renderArchiveSection();

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');

      expect(useHyperlinkClipboardStore.getState().getCache()).toBeNull();
    });
  });

  describe('guard conditions', () => {
    it('falls through when clipboard text differs from clipboardTextAtCopy', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'content', '/file.arbo', 'original-text');
      const { onChange } = renderArchiveSection();

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'something-else');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('clears stale cache when clipboard guard fails (mirrors pasteAsHyperlink)', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'content', '/file.arbo', 'original-text');
      renderArchiveSection();

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'something-else');

      expect(useHyperlinkClipboardStore.getState().getCache()).toBeNull();
    });

    it('falls through when sourceFilePath differs from currentFilePath', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'content', '/other.arbo', 'pasted-text');
      const { onChange } = renderArchiveSection();

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('falls through when no hyperlink cache is present', () => {
      const { onChange } = renderArchiveSection();

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not inject the cached nodeId on the archive-side link name input', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'content', '/file.arbo', 'pasted-text');
      const { onChange } = renderArchiveSection({
        archiveSettings: { archiveDestinationId: 'existing' },
      });

      fireSyntheticPaste(screen.getByLabelText(/archive-side link name/i), 'pasted-text');

      expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ archiveDestinationId: 'node-42' }));
    });
  });

  describe('edge cases', () => {
    it('falls through on a second paste once the first cleared the cache', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'content', '/file.arbo', 'pasted-text');
      const { onChange } = renderArchiveSection();
      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');
      onChange.mockClear();

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not inject when currentFilePath is null', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'content', '/file.arbo', 'pasted-text');
      const { onChange } = renderArchiveSection({ currentFilePath: null });

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('overwrites archiveDestinationId when one is already set', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'content', '/file.arbo', 'pasted-text');
      const { onChange } = renderArchiveSection({
        archiveSettings: { archiveDestinationId: 'old-dest' },
      });

      fireSyntheticPaste(screen.getByLabelText(/archive destination/i), 'pasted-text');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ archiveDestinationId: 'node-42' }));
    });
  });

  describe('accessibility and placeholder', () => {
    it('preserves the "Archive destination" aria-label', () => {
      renderArchiveSection();
      expect(screen.getByLabelText(/archive destination/i)).toBeInTheDocument();
    });

    it('preserves a placeholder communicating the hyperlink paste affordance', () => {
      renderArchiveSection();
      const input = screen.getByLabelText(/archive destination/i) as HTMLInputElement;
      expect(input.placeholder).toMatch(/hyperlink/i);
    });
  });
});
