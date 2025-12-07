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
    it('should render nothing when no context selected', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render execute context icon when only execute context is set', () => {
      const executeContext: AppliedContext = { icon: 'star', color: undefined, name: 'Execute Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          executeContext={executeContext}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
      expect(container.querySelector('.context-applied-badge')).not.toBeInTheDocument();
    });

    it('should render collaborate context icon when only collaborate context is set', () => {
      const collaborateContext: AppliedContext = { icon: 'flag', color: undefined, name: 'Collaborate Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          collaborateContext={collaborateContext}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
    });

    it('should render execute context icon with + badge when both contexts are set', () => {
      const executeContext: AppliedContext = { icon: 'star', color: undefined, name: 'Execute Context' };
      const collaborateContext: AppliedContext = { icon: 'flag', color: undefined, name: 'Collaborate Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          executeContext={executeContext}
          collaborateContext={collaborateContext}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
      expect(container.querySelector('.context-applied-badge')?.textContent).toBe('+');
    });

    it('should show tooltip on hover when both contexts are set', () => {
      const executeContext: AppliedContext = { icon: 'star', color: undefined, name: 'Execute Context' };
      const collaborateContext: AppliedContext = { icon: 'flag', color: undefined, name: 'Collaborate Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          executeContext={executeContext}
          collaborateContext={collaborateContext}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.context-applied');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Execute:')).toBeInTheDocument();
      expect(screen.getByText('Execute Context')).toBeInTheDocument();
      expect(screen.getByText('Collaborate:')).toBeInTheDocument();
      expect(screen.getByText('Collaborate Context')).toBeInTheDocument();
    });

    it('should not be clickable for regular nodes', () => {
      const executeContext: AppliedContext = { icon: 'star', color: undefined, name: 'Execute Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
          executeContext={executeContext}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.context-applied');
      if (indicator) fireEvent.click(indicator);
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
  });
});
