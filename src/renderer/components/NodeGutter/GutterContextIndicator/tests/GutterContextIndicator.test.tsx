import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GutterContextIndicator } from '../GutterContextIndicator';
import { AppliedContext } from '../../../TreeNode/hooks/useAppliedContexts';

describe('GutterContextIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when no applied context', () => {
    it('should render nothing for a regular node', () => {
      const { container } = render(
        <GutterContextIndicator />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render nothing for a context declaration node', () => {
      const { container } = render(
        <GutterContextIndicator />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('with applied context', () => {
    const appliedContext: AppliedContext = { icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false };

    it('should render applied context icon', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render at full opacity with no inline opacity style', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.context-applied');
      expect(indicator).toBeInTheDocument();
      expect(indicator).not.toHaveStyle({ opacity: '0.6' });
      expect(indicator).not.toHaveStyle({ opacity: 0.6 });
    });

    it('should apply color via CSS custom property when appliedContext has color', () => {
      const coloredContext: AppliedContext = { icon: 'star', color: '#ff0000', name: 'Red Context', collaborate: true, execute: false };
      const { container } = render(
        <GutterContextIndicator appliedContext={coloredContext} />
      );
      const indicator = container.querySelector('.context-applied') as HTMLElement;
      expect(indicator.style.getPropertyValue('--applied-context-color')).toBe('#ff0000');
    });

    it('should not apply color styling when appliedContext has no color', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.context-applied');
      expect(indicator).not.toHaveAttribute('style');
    });

    it('should render nothing when appliedContext has no icon', () => {
      const noIconContext: AppliedContext = { icon: undefined, color: undefined, name: 'No Icon', collaborate: true, execute: false };
      const { container } = render(
        <GutterContextIndicator appliedContext={noIconContext} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should not render as a button (non-clickable)', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('button')).not.toBeInTheDocument();
    });
  });

  describe('context declaration with applied context (combo case)', () => {
    const appliedContext: AppliedContext = { icon: 'flag', color: '#00ff00', name: 'Applied From Ancestor', collaborate: true, execute: false };

    it('should render applied context icon at full opacity', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-applied')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should not render declaration icon or bundle badge', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-declaration')).not.toBeInTheDocument();
      expect(container.querySelector('.context-bundle')).not.toBeInTheDocument();
      expect(container.querySelector('.context-bundle-badge')).not.toBeInTheDocument();
    });
  });

  describe('declaration-specific classes removed', () => {
    const appliedContext: AppliedContext = { icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false };

    it('should not render .context-declaration class', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-declaration')).not.toBeInTheDocument();
    });

    it('should not render .context-bundle class', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-bundle')).not.toBeInTheDocument();
    });

    it('should not render .context-bundle-badge', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      expect(container.querySelector('.context-bundle-badge')).not.toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    const appliedContext: AppliedContext = { icon: 'star', color: '#00ff00', name: 'Design Guidelines', collaborate: true, execute: false };

    it('should show tooltip on hover over applied context icon', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      expect(indicator).toBeInTheDocument();
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Applied context:')).toBeInTheDocument();
    });

    it('should display the correct context name in tooltip', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Design Guidelines')).toBeInTheDocument();
    });

    it('should display the context icon in tooltip', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      const tooltipItem = document.querySelector('.applied-context-tooltip-item');
      expect(tooltipItem?.querySelector('svg')).toBeInTheDocument();
    });

    it('should not show "Declared:" label in tooltip', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.queryByText('Declared:')).not.toBeInTheDocument();
    });

    it('should not show "Applied:" label (old format) in tooltip', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.queryByText('Applied:')).not.toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', () => {
      const { container } = render(
        <GutterContextIndicator appliedContext={appliedContext} />
      );
      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) {
        fireEvent.mouseEnter(indicator);
        expect(screen.getByText('Applied context:')).toBeInTheDocument();
        fireEvent.mouseLeave(indicator);
        expect(screen.queryByText('Applied context:')).not.toBeInTheDocument();
      }
    });

    it('should not render tooltip when there is no applied context', () => {
      const { container } = render(
        <GutterContextIndicator />
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByText('Applied context:')).not.toBeInTheDocument();
    });
  });
});
