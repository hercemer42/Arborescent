import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalCloseConfirmationDialog } from '../TerminalCloseConfirmationDialog';

// Dialog shown when the user attempts to close a terminal whose prompt is
// still processing. Modelled on RebindConfirmationDialog: destructive confirm,
// safe cancel, Escape cancels, outside-click cancels.

describe('TerminalCloseConfirmationDialog — rendering', () => {
  const defaultProps = {
    terminalTitle: 'Terminal 1',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders within a modal dialog', () => {
    render(<TerminalCloseConfirmationDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('names the terminal whose prompt would be abandoned', () => {
    render(<TerminalCloseConfirmationDialog {...defaultProps} terminalTitle="Claude — refactor pass" />);
    expect(screen.getByText(/Claude — refactor pass/)).toBeInTheDocument();
  });

  it('explains that a prompt is currently processing and will be abandoned', () => {
    render(<TerminalCloseConfirmationDialog {...defaultProps} />);
    // Copy must surface the "processing" reason so the user understands what
    // they are about to discard. The dialog may name the reason across more
    // than one paragraph.
    expect(screen.getAllByText(/processing|in[- ]flight|abandon/i).length).toBeGreaterThan(0);
  });

  it('renders a destructive confirm action and a safe cancel action', () => {
    render(<TerminalCloseConfirmationDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /close anyway|confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel|keep/i })).toBeInTheDocument();
  });
});

describe('TerminalCloseConfirmationDialog — user decisions', () => {
  let onConfirm: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onConfirm = vi.fn();
    onCancel = vi.fn();
  });

  function renderDialog() {
    return render(
      <TerminalCloseConfirmationDialog
        terminalTitle="Terminal 1"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  it('clicking the confirm button calls onConfirm and not onCancel', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /close anyway|confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('clicking the cancel button calls onCancel and not onConfirm', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('pressing Escape is treated as cancel', () => {
    renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking the modal overlay (outside the dialog body) is treated as cancel', () => {
    const { container } = renderDialog();
    const overlay = container.querySelector('.modal-overlay');
    expect(overlay).toBeInTheDocument();
    fireEvent.mouseDown(overlay as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking inside the dialog body does NOT trigger cancel', () => {
    renderDialog();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('TerminalCloseConfirmationDialog — accessibility', () => {
  it('the dialog is announced via role=dialog so screen readers pick it up on open', () => {
    render(
      <TerminalCloseConfirmationDialog
        terminalTitle="Terminal 1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it.todo('one of confirm / cancel receives initial focus so Enter activates by default');
  it.todo('focus is trapped within the dialog while it is open');
});
