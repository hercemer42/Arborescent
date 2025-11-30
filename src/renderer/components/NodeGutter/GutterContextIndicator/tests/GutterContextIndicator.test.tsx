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
    it('should render declaration icon when no bundled contexts', () => {
      render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      expect(screen.getByTitle('Click to change icon')).toBeInTheDocument();
    });

    it('should be clickable to change icon when no bundled contexts', () => {
      render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={[]}
          onIconClick={mockOnIconClick}
        />
      );
      fireEvent.click(screen.getByTitle('Click to change icon'));
      expect(mockOnIconClick).toHaveBeenCalled();
    });

    it('should show cog with count for single bundled context', () => {
      const bundledContexts: BundledContext[] = [{ icon: 'flag', name: 'Bundled Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.querySelector('.context-bundle-count')?.textContent).toBe('1');
    });

    it('should NOT be clickable for single bundled context', () => {
      const bundledContexts: BundledContext[] = [{ icon: 'flag', name: 'Bundled Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          onIconClick={mockOnIconClick}
        />
      );
      const indicator = container.querySelector('.context-bundle-indicator');
      if (indicator) fireEvent.click(indicator);
      expect(mockOnIconClick).not.toHaveBeenCalled();
    });

    it('should show cog with count for multiple bundled contexts', () => {
      const bundledContexts: BundledContext[] = [
        { icon: 'flag', name: 'Context A' },
        { icon: 'star', name: 'Context B' },
      ];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          bundledContexts={bundledContexts}
          onIconClick={mockOnIconClick}
        />
      );
      expect(container.querySelector('.context-bundle-count')?.textContent).toBe('2');
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
