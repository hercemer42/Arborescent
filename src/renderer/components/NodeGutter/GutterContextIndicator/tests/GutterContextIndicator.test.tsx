import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GutterContextIndicator } from '../GutterContextIndicator';
import { AppliedContext, BundledContext } from '../../../TreeNode/hooks/useAppliedContexts';

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
          bundledContexts={[]}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render active context icon', () => {
      const activeContext: AppliedContext = { icon: 'star', name: 'My Context' };
      render(
        <GutterContextIndicator
          isContextDeclaration={false}
          bundledContexts={[]}
          appliedContexts={[]}
          activeContext={activeContext}
          onIconClick={mockOnIconClick}
        />
      );
      expect(screen.getByTitle('Context: My Context')).toBeInTheDocument();
    });

    it('should not be clickable for regular nodes', () => {
      const activeContext: AppliedContext = { icon: 'star', name: 'My Context' };
      render(
        <GutterContextIndicator
          isContextDeclaration={false}
          bundledContexts={[]}
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
    it('should render declaration icon when no bundled or applied contexts', () => {
      render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={[]}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      expect(screen.getByTitle('Click to change icon')).toBeInTheDocument();
    });

    it('should be clickable to change icon when no bundled or applied contexts', () => {
      render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={[]}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      fireEvent.click(screen.getByTitle('Click to change icon'));
      expect(mockOnIconClick).toHaveBeenCalled();
    });

    it('should show cog with count for single bundled context (includes self)', () => {
      const bundledContexts: BundledContext[] = [{ icon: 'flag', name: 'Bundled Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      // Count is 1 (self) + bundledContexts.length + appliedContexts.length
      expect(container.querySelector('.context-bundle-count')?.textContent).toBe('2');
    });

    it('should show cog with count including applied contexts', () => {
      const appliedContexts: AppliedContext[] = [{ icon: 'heart', name: 'Applied Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={[]}
          appliedContexts={appliedContexts}
          onIconClick={mockOnIconClick}
        />
      );
      // Count is 1 (self) + 0 bundled + 1 applied = 2
      expect(container.querySelector('.context-bundle-count')?.textContent).toBe('2');
    });

    it('should show cog with count for bundled and applied contexts combined', () => {
      const bundledContexts: BundledContext[] = [{ icon: 'flag', name: 'Bundled Context' }];
      const appliedContexts: AppliedContext[] = [{ icon: 'heart', name: 'Applied Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          appliedContexts={appliedContexts}
          onIconClick={mockOnIconClick}
        />
      );
      // Count is 1 (self) + 1 bundled + 1 applied = 3
      expect(container.querySelector('.context-bundle-count')?.textContent).toBe('3');
    });

    it('should NOT be clickable for single bundled context', () => {
      const bundledContexts: BundledContext[] = [{ icon: 'flag', name: 'Bundled Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.context-bundle-indicator');
      if (indicator) fireEvent.click(indicator);
      expect(mockOnIconClick).not.toHaveBeenCalled();
    });

    it('should show cog with count for multiple bundled contexts (includes self)', () => {
      const bundledContexts: BundledContext[] = [
        { icon: 'flag', name: 'Context A' },
        { icon: 'star', name: 'Context B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      // Count is 1 (self) + bundledContexts.length
      expect(container.querySelector('.context-bundle-count')?.textContent).toBe('3');
    });

    it('should NOT be clickable for multiple bundled contexts', () => {
      const bundledContexts: BundledContext[] = [
        { icon: 'flag', name: 'Context A' },
        { icon: 'star', name: 'Context B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.context-bundle-indicator');
      if (indicator) fireEvent.click(indicator);
      expect(mockOnIconClick).not.toHaveBeenCalled();
    });

    it('should show tooltip on hover for bundled contexts', () => {
      const bundledContexts: BundledContext[] = [
        { icon: 'flag', name: 'Context A' },
        { icon: 'star', name: 'Context B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      const bundle = container.querySelector('.context-bundle');
      if (bundle) fireEvent.mouseEnter(bundle);
      expect(screen.getByText('Declared context:')).toBeInTheDocument();
      expect(screen.getByText('This node')).toBeInTheDocument();
      expect(screen.getByText('Bundled declarations:')).toBeInTheDocument();
      expect(screen.getByText('Context A')).toBeInTheDocument();
      expect(screen.getByText('Context B')).toBeInTheDocument();
    });

    it('should show tooltip with applied contexts section', () => {
      const appliedContexts: AppliedContext[] = [
        { icon: 'heart', name: 'Applied A' },
        { icon: 'bookmark', name: 'Applied B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={[]}
          appliedContexts={appliedContexts}
          onIconClick={mockOnIconClick}
        />
      );
      const bundle = container.querySelector('.context-bundle');
      if (bundle) fireEvent.mouseEnter(bundle);
      expect(screen.getByText('Declared context:')).toBeInTheDocument();
      expect(screen.getByText('This node')).toBeInTheDocument();
      expect(screen.getByText('Applied contexts:')).toBeInTheDocument();
      expect(screen.getByText('Applied A')).toBeInTheDocument();
      expect(screen.getByText('Applied B')).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', () => {
      const bundledContexts: BundledContext[] = [
        { icon: 'flag', name: 'Context A' },
        { icon: 'star', name: 'Context B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          appliedContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      const bundle = container.querySelector('.context-bundle');
      if (bundle) {
        fireEvent.mouseEnter(bundle);
        expect(screen.getByText('Declared context:')).toBeInTheDocument();
        fireEvent.mouseLeave(bundle);
        expect(screen.queryByText('Declared context:')).not.toBeInTheDocument();
      }
    });
  });
});
