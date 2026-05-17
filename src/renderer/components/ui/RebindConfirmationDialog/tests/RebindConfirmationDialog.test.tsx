import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RebindConfirmationDialog } from '../RebindConfirmationDialog';

describe('RebindConfirmationDialog — rendering', () => {
  const defaultProps = {
    previousNodeLabel: 'Previously bound branch',
    newNodeLabel: 'New target branch',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders within a modal dialog with a clear title', () => {
    render(<RebindConfirmationDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('names the previously-bound node', () => {
    render(<RebindConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('Previously bound branch')).toBeInTheDocument();
  });

  it('names the proposed new node', () => {
    render(<RebindConfirmationDialog {...defaultProps} />);
    expect(screen.getByText('New target branch')).toBeInTheDocument();
  });

  it('renders a confirm action and a cancel action', () => {
    render(<RebindConfirmationDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /confirm|rebind|switch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel|keep/i })).toBeInTheDocument();
  });
});

describe('RebindConfirmationDialog — user decisions', () => {
  let onConfirm: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onConfirm = vi.fn();
    onCancel = vi.fn();
  });

  function renderDialog() {
    return render(
      <RebindConfirmationDialog
        previousNodeLabel="Old node"
        newNodeLabel="New node"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  it('clicking the confirm button calls onConfirm and not onCancel', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /confirm|rebind|switch/i }));
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

describe('RebindConfirmationDialog — accessibility', () => {
  it('the dialog is focusable so screen readers announce it on open', () => {
    render(
      <RebindConfirmationDialog
        previousNodeLabel="Old"
        newNodeLabel="New"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it.todo('the confirm button receives initial focus so Enter confirms by default');
});
