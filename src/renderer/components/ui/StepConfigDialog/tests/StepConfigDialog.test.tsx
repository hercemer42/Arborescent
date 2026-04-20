import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepConfigDialog } from '../StepConfigDialog';
import type { StepType } from '@/store/tree/commands/SetStepTypeCommand';

describe('StepConfigDialog', () => {
  const defaultProps = {
    nodeId: 'node-1',
    currentStepType: 'manual' as StepType,
    decomposition: false,
    onStepTypeChange: vi.fn(),
    onDecompositionChange: vi.fn(),
    onRecurseChange: vi.fn(),
    onClearSessionChange: vi.fn(),
    onArchiveSettingsChange: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render three step type options', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.getByText('Manual')).toBeInTheDocument();
      expect(screen.getByText('Checkpoint')).toBeInTheDocument();
      expect(screen.getByText('Autonomous')).toBeInTheDocument();
    });

    it('should render within a modal with title', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.getByText('Step Configuration')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should show the current step type as selected', () => {
      const { container } = render(
        <StepConfigDialog {...defaultProps} currentStepType="checkpoint" />
      );

      const selectedRadio = container.querySelector('input[value="checkpoint"]') as HTMLInputElement;
      expect(selectedRadio).toBeInTheDocument();
      expect(selectedRadio.checked).toBe(true);
    });

    it('should default to manual when stepType is undefined', () => {
      const { container } = render(
        <StepConfigDialog {...defaultProps} currentStepType={undefined as unknown as StepType} />
      );

      const manualRadio = container.querySelector('input[value="manual"]') as HTMLInputElement;
      expect(manualRadio).toBeInTheDocument();
      expect(manualRadio.checked).toBe(true);
    });
  });

  describe('step type descriptions', () => {
    it('should show manual description when manual is selected', () => {
      render(<StepConfigDialog {...defaultProps} currentStepType="manual" />);

      expect(screen.getByText('Nothing is sent to the terminal. You act manually.')).toBeInTheDocument();
    });

    it('should show checkpoint description when checkpoint is selected', () => {
      render(<StepConfigDialog {...defaultProps} currentStepType="checkpoint" />);

      expect(screen.getByText('Content is sent automatically. Pauses for your review before advancing.')).toBeInTheDocument();
    });

    it('should show autonomous description when autonomous is selected', () => {
      render(<StepConfigDialog {...defaultProps} currentStepType="autonomous" />);

      expect(screen.getByText('Content is sent and advances automatically. Ensure contexts are configured correctly.')).toBeInTheDocument();
    });

    it('should show manual description when stepType is undefined', () => {
      render(<StepConfigDialog {...defaultProps} currentStepType={undefined as unknown as StepType} />);

      expect(screen.getByText('Nothing is sent to the terminal. You act manually.')).toBeInTheDocument();
    });
  });

  describe('decomposition description', () => {
    it('should show decomposition helper text', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.getByText('AI response creates multiple sibling nodes instead of replacing the original.')).toBeInTheDocument();
    });
  });

  describe('step type selection', () => {
    it('should call onStepTypeChange with the selected step type', () => {
      render(<StepConfigDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Autonomous'));

      expect(defaultProps.onStepTypeChange).toHaveBeenCalledWith('node-1', 'autonomous');
    });

    it('should not call onStepTypeChange when clicking the already-selected type', () => {
      render(<StepConfigDialog {...defaultProps} currentStepType="manual" />);

      fireEvent.click(screen.getByText('Manual'));

      expect(defaultProps.onStepTypeChange).not.toHaveBeenCalled();
    });
  });

  describe('dismissal', () => {
    it('should call onClose when clicking outside the dialog', () => {
      const { container } = render(<StepConfigDialog {...defaultProps} />);

      const overlay = container.querySelector('.modal-overlay');
      fireEvent.mouseDown(overlay!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not call onClose when clicking inside the dialog', () => {
      const { container } = render(<StepConfigDialog {...defaultProps} />);

      const dialog = container.querySelector('.modal-dialog');
      fireEvent.mouseDown(dialog!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape is pressed', () => {
      render(<StepConfigDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', () => {
      render(<StepConfigDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('×'));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('decomposition toggle', () => {
    it('should render a decomposition checkbox', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.getByLabelText(/decomposition/i)).toBeInTheDocument();
    });

    it('should reflect current decomposition value as checked', () => {
      render(<StepConfigDialog {...defaultProps} decomposition={true} />);

      const checkbox = screen.getByLabelText(/decomposition/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('should default to unchecked when decomposition is undefined', () => {
      render(<StepConfigDialog {...defaultProps} />);

      const checkbox = screen.getByLabelText(/decomposition/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should call onDecompositionChange when toggled', () => {
      render(<StepConfigDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText(/decomposition/i));

      expect(defaultProps.onDecompositionChange).toHaveBeenCalledWith('node-1', true);
    });
  });

  describe('recurse toggle', () => {
    it('should render a recurse checkbox', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.getByLabelText(/recurse/i)).toBeInTheDocument();
    });

    it('should reflect current recurse value as checked', () => {
      render(<StepConfigDialog {...defaultProps} recurse={true} />);

      const checkbox = screen.getByLabelText(/recurse/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('should default to unchecked when recurse is undefined', () => {
      render(<StepConfigDialog {...defaultProps} />);

      const checkbox = screen.getByLabelText(/recurse/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('should call onRecurseChange when toggled', () => {
      render(<StepConfigDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText(/recurse/i));

      expect(defaultProps.onRecurseChange).toHaveBeenCalledWith('node-1', true);
    });
  });

  describe('archive settings', () => {
    it('should render archive destination input', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.getByLabelText(/archive destination/i)).toBeInTheDocument();
    });

    it('should show link name inputs when archive destination is set', () => {
      render(<StepConfigDialog {...defaultProps} archiveSettings={{ archiveDestinationId: 'dest-1' }} />);

      expect(screen.getByLabelText(/archive-side link name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/replacement-side link name/i)).toBeInTheDocument();
    });

    it('should hide link name inputs when archive destination is empty', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.queryByLabelText(/archive-side link name/i)).not.toBeInTheDocument();
    });

    it('should render resolve linked content toggle when archive is set', () => {
      render(<StepConfigDialog {...defaultProps} archiveSettings={{ archiveDestinationId: 'dest-1' }} />);

      const toggle = screen.getByLabelText(/resolve linked content/i) as HTMLInputElement;
      expect(toggle).toBeInTheDocument();
      expect(toggle.checked).toBe(false);
    });

    it('should show warning for autonomous step without archive destination', () => {
      render(<StepConfigDialog {...defaultProps} currentStepType="autonomous" />);

      expect(screen.getByText(/original content will be lost/i)).toBeInTheDocument();
    });

    it('should not show warning when archive destination is set', () => {
      render(<StepConfigDialog {...defaultProps} currentStepType="autonomous" archiveSettings={{ archiveDestinationId: 'dest-1' }} />);

      expect(screen.queryByText(/original content will be lost/i)).not.toBeInTheDocument();
    });

    it('should call onArchiveSettingsChange when destination is changed', () => {
      render(<StepConfigDialog {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/archive destination/i), { target: { value: 'new-dest' } });

      expect(defaultProps.onArchiveSettingsChange).toHaveBeenCalledWith('node-1', expect.objectContaining({ archiveDestinationId: 'new-dest' }));
    });
  });

  describe('accessibility', () => {
    it('should have radio group for step type options', () => {
      render(<StepConfigDialog {...defaultProps} />);

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });
  });
});
