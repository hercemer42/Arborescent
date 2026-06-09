import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Tab } from '../Tab';
import type { TabIndicatorType } from '../Tab';

const baseProps = {
  displayName: 'session.arbo',
  isActive: false,
  onClick: vi.fn(),
  onClose: vi.fn(),
};

const INDICATORS: Exclude<TabIndicatorType, null>[] = ['feedbackPending', 'workflowRunning', 'actionRequired'];

describe('Tab focus geometry stability', () => {
  describe('indicator slot is reserved regardless of focus', () => {
    it.each(INDICATORS)(
      'keeps the %s indicator element mounted in both inactive and active states',
      (indicator) => {
        const inactive = render(<Tab {...baseProps} isActive={false} indicator={indicator} />);
        expect(inactive.container.querySelector('.tab-indicator')).not.toBeNull();

        const active = render(<Tab {...baseProps} isActive={true} indicator={indicator} />);
        expect(active.container.querySelector('.tab-indicator')).not.toBeNull();
      },
    );
  });

  describe('plain tabs (no indicator, no pending review) are unaffected', () => {
    it('never mounts an indicator element, whether active or inactive', () => {
      const inactive = render(<Tab {...baseProps} isActive={false} />);
      expect(inactive.container.querySelector('.tab-indicator')).toBeNull();

      const active = render(<Tab {...baseProps} isActive={true} />);
      expect(active.container.querySelector('.tab-indicator')).toBeNull();
    });

    it('renders the same structural elements (name + close, no indicator) in both focus states', () => {
      const shape = (root: HTMLElement) => ({
        name: !!root.querySelector('.tab-name'),
        close: !!root.querySelector('.tab-close'),
        indicator: !!root.querySelector('.tab-indicator'),
      });

      const inactive = render(<Tab {...baseProps} isActive={false} />);
      const active = render(<Tab {...baseProps} isActive={true} />);

      expect(shape(active.container)).toEqual(shape(inactive.container));
    });
  });

  // Width and spacing are layout properties; the jsdom test environment loads no
  // stylesheet, so these are title-only and need a layout-capable runner to exercise.
  describe('width and spacing do not change on focus (layout — title only)', () => {
    it.todo('an indicator tab keeps the same rendered width when toggled inactive -> active');
    it.todo('the gap between the file name and the close button is identical whether or not the tab is active');
    it.todo('a review-pending tab keeps the same width active and inactive (no bold-weight reflow)');
    it.todo("rapidly switching focus between two indicator tabs never changes either tab's width");
    it.todo('a name at the 80px min-width still ellipsises correctly once the indicator slot is permanently reserved');
  });

  describe('review-pending "needs attention" signal survives the weight change (title only)', () => {
    it.todo('the pending-review affordance stays perceivable when font-weight:600 is replaced by a non-widening emphasis');
    it.todo('the orange underline still marks a pending-review tab once it becomes the active tab');
  });

  describe('accessibility of the reserved indicator slot', () => {
    it('marks the reserved indicator aria-hidden on the active tab so it is not announced', () => {
      const { container } = render(<Tab {...baseProps} isActive={true} indicator="actionRequired" />);
      expect(container.querySelector('.tab-indicator')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('leaves the visible indicator announced (not aria-hidden) on an inactive tab', () => {
      const { container } = render(<Tab {...baseProps} isActive={false} indicator="actionRequired" />);
      expect(container.querySelector('.tab-indicator')?.getAttribute('aria-hidden')).toBeNull();
    });
  });
});
