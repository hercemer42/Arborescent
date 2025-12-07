import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GutterContextIndicator } from '../GutterContextIndicator';
import { AppliedContext } from '../../../TreeNode/hooks/useAppliedContexts';

describe('GutterContextIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('regular nodes', () => {
    it('should render nothing when no context selected', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={false}
          appliedContexts={[]}
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
        />
      );
      const indicator = container.querySelector('.context-applied');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Execute:')).toBeInTheDocument();
      expect(screen.getByText('Execute Context')).toBeInTheDocument();
      expect(screen.getByText('Collaborate:')).toBeInTheDocument();
      expect(screen.getByText('Collaborate Context')).toBeInTheDocument();
    });
  });

  describe('context declaration nodes', () => {
    it('should render declaration icon without + badge when no applied contexts', () => {
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="lightbulb"
          appliedContexts={[]}
        />
      );
      expect(container.querySelector('.context-declaration')).toBeInTheDocument();
      expect(container.querySelector('.context-bundle-badge')).not.toBeInTheDocument();
    });

    it('should render + badge when has applied contexts', () => {
      const appliedContexts: AppliedContext[] = [{ icon: 'flag', color: undefined, name: 'Applied Context' }];
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="Lightbulb"
          appliedContexts={appliedContexts}
        />
      );
      expect(container.querySelector('.context-bundle-badge')?.textContent).toBe('+');
      expect(container.querySelector('.context-bundle')).toBeInTheDocument();
    });

    it('should render + badge when has executeContext', () => {
      const executeContext: AppliedContext = { icon: 'star', color: undefined, name: 'Execute Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="Lightbulb"
          appliedContexts={[]}
          executeContext={executeContext}
        />
      );
      expect(container.querySelector('.context-bundle-badge')?.textContent).toBe('+');
      expect(container.querySelector('.context-bundle')).toBeInTheDocument();
    });

    it('should render + badge when has collaborateContext', () => {
      const collaborateContext: AppliedContext = { icon: 'flag', color: undefined, name: 'Collaborate Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextIcon="Lightbulb"
          appliedContexts={[]}
          collaborateContext={collaborateContext}
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
          appliedContexts={[]}
        />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Declared:')).toBeInTheDocument();
      expect(screen.getByText('My Context')).toBeInTheDocument();
    });

    it('should show tooltip with action contexts when both are set', () => {
      const executeContext: AppliedContext = { icon: 'star', color: undefined, name: 'Execute Context' };
      const collaborateContext: AppliedContext = { icon: 'flag', color: undefined, name: 'Collaborate Context' };
      const { container } = render(
        <GutterContextIndicator
          isContextDeclaration={true}
          contextName="My Context"
          contextIcon="lightbulb"
          appliedContexts={[]}
          executeContext={executeContext}
          collaborateContext={collaborateContext}
        />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Declared:')).toBeInTheDocument();
      expect(screen.getByText('My Context')).toBeInTheDocument();
      expect(screen.getByText('Execute:')).toBeInTheDocument();
      expect(screen.getByText('Execute Context')).toBeInTheDocument();
      expect(screen.getByText('Collaborate:')).toBeInTheDocument();
      expect(screen.getByText('Collaborate Context')).toBeInTheDocument();
    });
  });
});
