import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepConfigDialog } from '../StepConfigDialog';
import type { StepType } from '@/store/tree/commands/SetStepTypeCommand';

describe('StepConfigDialog — Clear AI session toggle', () => {
  const defaultProps = {
    nodeId: 'node-1',
    currentStepType: 'autonomous' as StepType,
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
    it('renders a checkbox with the label "Clear AI session"', () => {
      render(<StepConfigDialog {...(defaultProps as unknown as Parameters<typeof StepConfigDialog>[0])} />);

      expect(screen.getByLabelText(/clear ai session/i)).toBeInTheDocument();
    });

    it('defaults to unchecked when clearSession is undefined', () => {
      render(<StepConfigDialog {...(defaultProps as unknown as Parameters<typeof StepConfigDialog>[0])} />);

      const checkbox = screen.getByLabelText(/clear ai session/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('reflects the current clearSession value as checked', () => {
      render(
        <StepConfigDialog
          {...(({ ...defaultProps, clearSession: true }) as unknown as Parameters<typeof StepConfigDialog>[0])}
        />,
      );

      const checkbox = screen.getByLabelText(/clear ai session/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('toggling', () => {
    it('calls onClearSessionChange with (nodeId, true) when toggled on', () => {
      render(<StepConfigDialog {...(defaultProps as unknown as Parameters<typeof StepConfigDialog>[0])} />);

      fireEvent.click(screen.getByLabelText(/clear ai session/i));

      expect(defaultProps.onClearSessionChange).toHaveBeenCalledWith('node-1', true);
    });

    it('calls onClearSessionChange with (nodeId, false) when toggled off', () => {
      render(
        <StepConfigDialog
          {...(({ ...defaultProps, clearSession: true }) as unknown as Parameters<typeof StepConfigDialog>[0])}
        />,
      );

      fireEvent.click(screen.getByLabelText(/clear ai session/i));

      expect(defaultProps.onClearSessionChange).toHaveBeenCalledWith('node-1', false);
    });
  });

  describe('accessibility', () => {
    it('has an accessible label "Clear AI session"', () => {
      render(<StepConfigDialog {...(defaultProps as unknown as Parameters<typeof StepConfigDialog>[0])} />);

      expect(screen.getByRole('checkbox', { name: /clear ai session/i })).toBeInTheDocument();
    });

    it('is keyboard-reachable and toggles via Space like sibling option checkboxes');
  });

  describe('disclosure of destructive behaviour', () => {
    it('surfaces copy that the option resets the AI session and wipes unsent terminal input');
  });
});
