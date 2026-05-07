import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { GutterContextIndicator } from '../GutterContextIndicator';
import { AppliedContext } from '../../../TreeNode/hooks/useAppliedContexts';

describe('GutterContextIndicator — mode display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visual mode distinction', () => {
    it('should render for collaborate-mode context', () => {
      const appliedContext: AppliedContext = { icon: 'Eye', color: '#0ea5e9', name: 'Review', collaborate: true, execute: false };
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
    });

    it('should render for execute-mode context', () => {
      const appliedContext: AppliedContext = { icon: 'Wrench', color: '#14b8a6', name: 'Implement', collaborate: true, execute: true };
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
    });
  });

  describe('tooltip shows mode', () => {
    it('should show mode label in tooltip for collaborate-mode context', () => {
      const appliedContext: AppliedContext = { icon: 'Eye', color: '#0ea5e9', name: 'Review', collaborate: true, execute: false };
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(document.body.textContent).toContain('Collaborate');
    });

    it('should show mode label in tooltip for execute-mode context', () => {
      const appliedContext: AppliedContext = { icon: 'Wrench', color: '#14b8a6', name: 'Implement', collaborate: true, execute: true };
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(document.body.textContent).toContain('Collaborate & Execute');
    });

    it('should show context name alongside mode in tooltip', () => {
      const appliedContext: AppliedContext = { icon: 'Eye', color: '#0ea5e9', name: 'Design Guidelines', collaborate: true, execute: false };
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(document.body.textContent).toContain('Design Guidelines');
    });
  });
});
