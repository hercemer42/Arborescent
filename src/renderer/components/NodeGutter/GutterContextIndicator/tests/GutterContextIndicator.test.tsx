import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GutterContextIndicator } from '../GutterContextIndicator';
import { AppliedContext } from '../../../TreeNode/hooks/useAppliedContexts';

describe('GutterContextIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('regular nodes', () => {
    it('should render nothing when no applied context', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render applied context icon when appliedContext is set', () => {
      const appliedContext: AppliedContext = { icon: 'star', color: undefined, name: 'Applied Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContext={appliedContext}
        />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
    });

    it('should apply color styling when appliedContext has color', () => {
      const appliedContext: AppliedContext = { icon: 'star', color: '#ff0000', name: 'Applied Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContext={appliedContext}
        />
      );
      const indicator = container.querySelector('.context-applied');
      expect(indicator).toHaveStyle({ color: '#ff0000' });
    });
  });

  describe('context declaration nodes', () => {
    it('should render declaration icon without + badge when no applied context', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
        />
      );
      expect(container.querySelector('.context-declaration')).toBeInTheDocument();
      expect(container.querySelector('.context-bundle-badge')).not.toBeInTheDocument();
    });

    it('should render + badge when has applied context', () => {
      const appliedContext: AppliedContext = { icon: 'flag', color: undefined, name: 'Applied Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="Lightbulb"
          appliedContext={appliedContext}
        />
      );
      expect(container.querySelector('.context-bundle-badge')?.textContent).toBe('+');
      expect(container.querySelector('.context-bundle')).toBeInTheDocument();
    });

    it('should show tooltip on hover with declaration info', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextName="My Context"
          contextIcon="lightbulb"
        />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Declared:')).toBeInTheDocument();
      expect(screen.getByText('My Context')).toBeInTheDocument();
    });

    it('should show tooltip with applied context when set', () => {
      const appliedContext: AppliedContext = { icon: 'star', color: undefined, name: 'Applied Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextName="My Context"
          contextIcon="lightbulb"
          appliedContext={appliedContext}
        />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Declared:')).toBeInTheDocument();
      expect(screen.getByText('My Context')).toBeInTheDocument();
      expect(screen.getByText('Applied:')).toBeInTheDocument();
      expect(screen.getByText('Applied Context')).toBeInTheDocument();
    });
  });
});
