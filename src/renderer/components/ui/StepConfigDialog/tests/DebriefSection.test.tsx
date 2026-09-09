import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebriefSection } from '../DebriefSection';
import { useHyperlinkClipboardStore } from '@/store/clipboard/hyperlinkClipboardStore';

// Configuring a Findings node is the capability grant, so the paste is the
// place every failure has to be visible: a link into another file cannot work
// (one store per session on the direct-apply path, and hyperlink creation is
// same-file only) and must store nothing rather than store a dangling id.

type DebriefSectionProps = React.ComponentProps<typeof DebriefSection>;

function renderDebriefSection(overrides: Partial<DebriefSectionProps> = {}) {
  const onChange = vi.fn();
  const props: DebriefSectionProps = {
    stepType: 'autonomous',
    currentFilePath: '/file.arbo',
    onChange,
    ...overrides,
  };
  const utils = render(<DebriefSection {...props} />);
  return { ...utils, onChange };
}

function fireSyntheticPaste(input: HTMLElement, text: string) {
  fireEvent.paste(input, {
    clipboardData: { getData: (type: string) => (type === 'text/plain' ? text : '') },
  } as unknown as ClipboardEventInit);
}

const findingsInput = () => screen.getByLabelText(/findings node/i);

describe('DebriefSection hyperlink paste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHyperlinkClipboardStore.setState({ cache: null });
  });

  describe('happy path', () => {
    it('stores the cached nodeId when the cache and the clipboard guard match', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'pasted-text');
      const { onChange } = renderDebriefSection();

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(onChange).toHaveBeenCalledWith('node-42');
    });

    it('clears the hyperlink cache after a successful paste', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'pasted-text');
      renderDebriefSection();

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(useHyperlinkClipboardStore.getState().getCache()).toBeNull();
    });

    it('raises no error on a successful paste', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'pasted-text');
      renderDebriefSection();

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the configured target content as confirmation', () => {
      renderDebriefSection({ debriefDestinationId: 'node-42', destinationContent: 'Findings' });

      expect(screen.getByText('Findings')).toBeInTheDocument();
    });
  });

  describe('refusals — nothing is stored', () => {
    it('refuses a hyperlink from another file with an inline error', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/other.arbo', 'pasted-text');
      const { onChange } = renderDebriefSection();

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('names the same-file constraint in the cross-file error', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/other.arbo', 'pasted-text');
      renderDebriefSection();

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(screen.getByRole('alert').textContent).toMatch(/same file|this file|another file/i);
    });

    it('refuses a paste whose clipboard text no longer matches the copy, and clears the stale cache', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'original-text');
      const { onChange } = renderDebriefSection();

      fireSyntheticPaste(findingsInput(), 'something-else');

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
      expect(useHyperlinkClipboardStore.getState().getCache()).toBeNull();
    });

    it('refuses a plain-text paste with no hyperlink cache', () => {
      const { onChange } = renderDebriefSection();

      fireSyntheticPaste(findingsInput(), 'just some text');

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('distinguishes the no-cache error from the cross-file error', () => {
      renderDebriefSection();
      fireSyntheticPaste(findingsInput(), 'just some text');
      const noCache = screen.getByRole('alert').textContent;

      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/other.arbo', 'pasted-text');
      fireSyntheticPaste(findingsInput(), 'pasted-text');
      const crossFile = screen.getByRole('alert').textContent;

      expect(noCache).not.toBe(crossFile);
    });

    it('refuses the paste when no file is open', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'pasted-text');
      const { onChange } = renderDebriefSection({ currentFilePath: null });

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('stores nothing on a second paste once the first cleared the cache', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'pasted-text');
      const { onChange } = renderDebriefSection();
      fireSyntheticPaste(findingsInput(), 'pasted-text');
      onChange.mockClear();

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('clears a prior error once a valid paste lands', () => {
      const { onChange } = renderDebriefSection();
      fireSyntheticPaste(findingsInput(), 'just some text');
      expect(screen.getByRole('alert')).toBeInTheDocument();

      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'pasted-text');
      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith('node-42');
    });
  });

  describe('offered only where the write can land', () => {
    it('disables the control on a manual step', () => {
      renderDebriefSection({ stepType: 'manual' });
      expect(findingsInput()).toBeDisabled();
    });

    it('states the reason on a manual step', () => {
      renderDebriefSection({ stepType: 'manual' });
      expect(screen.getByText(/autonomous/i)).toBeInTheDocument();
    });

    it('disables the control on a checkpoint step', () => {
      renderDebriefSection({ stepType: 'checkpoint' });
      expect(findingsInput()).toBeDisabled();
    });

    it('states the reason on a checkpoint step', () => {
      renderDebriefSection({ stepType: 'checkpoint' });
      expect(screen.getByText(/autonomous/i)).toBeInTheDocument();
    });

    it('enables the control on an autonomous step', () => {
      renderDebriefSection();
      expect(findingsInput()).toBeEnabled();
    });

    it('stores nothing from a paste on a disabled control', () => {
      useHyperlinkClipboardStore.getState().setCache('node-42', 'Findings', '/file.arbo', 'pasted-text');
      const { onChange } = renderDebriefSection({ stepType: 'manual' });

      fireSyntheticPaste(findingsInput(), 'pasted-text');

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('authoring mistakes surface where they were made', () => {
    it('marks an autonomous step with no Findings node as incomplete', () => {
      const { container } = renderDebriefSection();
      expect(container.querySelector('.step-config-warning')).not.toBeNull();
    });

    it('drops the incomplete marker once a Findings node is configured', () => {
      const { container } = renderDebriefSection({ debriefDestinationId: 'node-42' });
      expect(container.querySelector('.step-config-warning')).toBeNull();
    });

    it('raises no incomplete marker on a manual step, where a debrief is not offered at all', () => {
      const { container } = renderDebriefSection({ stepType: 'manual' });
      expect(container.querySelector('.step-config-warning')).toBeNull();
    });

  });

  describe('accessibility', () => {
    it('labels the destination input', () => {
      renderDebriefSection();
      expect(findingsInput()).toBeInTheDocument();
    });

    it('announces a refusal through an alert role rather than colour or placement alone', () => {
      renderDebriefSection();
      fireSyntheticPaste(findingsInput(), 'just some text');
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('communicates the hyperlink paste affordance in the placeholder', () => {
      renderDebriefSection();
      expect((findingsInput() as HTMLInputElement).placeholder).toMatch(/hyperlink/i);
    });
  });
});
