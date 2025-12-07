import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GutterContextIndicator } from '../GutterContextIndicator';
import { AppliedContext } from '../../../TreeNode/hooks/useAppliedContexts';

describe('GutterContextIndicator', () => {
  const mockOnIconClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('regular nodes', () => {
    it('should render nothing when no active context', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render active context icon', () => {
      const activeContext: AppliedContext = { icon: 'star', color: undefined, name: 'My Context' };
      render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          activeContext={activeContext}
          onIconClick={mockOnIconClick}
        />
      );
      expect(screen.getByTitle('Context: My Context')).toBeInTheDocument();
    });

    it('should not be clickable for regular nodes', () => {
      const activeContext: AppliedContext = { icon: 'star', color: undefined, name: 'My Context' };
      render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          activeContext={activeContext}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = screen.getByTitle('Context: My Context');
      fireEvent.click(indicator);
      expect(mockOnIconClick).not.toHaveBeenCalled();
    });
  });

  describe('context declaration nodes', () => {
    it('should render declaration icon without + badge when no applied contexts', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.querySelector('.context-declaration')).toBeInTheDocument();
      expect(container.querySelector('.context-bundle-badge')).not.toBeInTheDocument();
    });

    it('should be clickable to change icon', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.click(indicator);
      expect(mockOnIconClick).toHaveBeenCalled();
    });

    it('should render + badge when has applied contexts', () => {
      const appliedContexts: AppliedContext[] = [{ icon: 'flag', color: undefined, name: 'Applied Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="Lightbulb"
          appliedContexts={appliedContexts}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.querySelector('.context-bundle-badge')?.textContent).toBe('+');
      expect(container.querySelector('.context-bundle')).toBeInTheDocument();
    });

    it('should show tooltip on hover when has applied contexts', () => {
      const appliedContexts: AppliedContext[] = [
        { icon: 'flag', color: undefined, name: 'Context A' },
        { icon: 'star', color: undefined, name: 'Context B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          appliedContexts={appliedContexts}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.context-bundle');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Declared context:')).toBeInTheDocument();
      expect(screen.getByText('This node')).toBeInTheDocument();
      expect(screen.getByText('Applied contexts:')).toBeInTheDocument();
      expect(screen.getByText('Context A')).toBeInTheDocument();
      expect(screen.getByText('Context B')).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', () => {
      const appliedContexts: AppliedContext[] = [
        { icon: 'flag', color: undefined, name: 'Context A' },
        { icon: 'star', color: undefined, name: 'Context B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          appliedContexts={appliedContexts}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.context-bundle');
      if (indicator) {
        fireEvent.mouseEnter(indicator);
        expect(screen.getByText('Declared context:')).toBeInTheDocument();
        fireEvent.mouseLeave(indicator);
        expect(screen.queryByText('Declared context:')).not.toBeInTheDocument();
      }
    });

    it('should not show tooltip when no applied contexts', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      // No tooltip when no applied contexts
      expect(screen.queryByText('Declared context:')).not.toBeInTheDocument();
    });
  });
});
