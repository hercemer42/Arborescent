import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tab } from '../Tab';

const defaultProps = {
  displayName: 'Test File',
  isActive: false,
  onClick: vi.fn(),
  onClose: vi.fn(),
};

describe('Tab indicator rendering', () => {
  it('should render indicator dot when feedbackPending and tab is not active', () => {
    render(<Tab {...defaultProps} indicator="feedbackPending" />);
    expect(screen.getByTitle('Feedback pending')).toBeDefined();
  });

  it('should render indicator dot when workflowRunning and tab is not active', () => {
    render(<Tab {...defaultProps} indicator="workflowRunning" />);
    expect(screen.getByTitle('Workflow running')).toBeDefined();
  });

  it('should render indicator dot when actionRequired and tab is not active', () => {
    render(<Tab {...defaultProps} indicator="actionRequired" />);
    expect(screen.getByTitle('Action required')).toBeDefined();
  });

  it('keeps the indicator element mounted when the tab is active so its slot is reserved', () => {
    // The dot used to be conditionally mounted on !isActive, so focusing a tab unmounted it
    // and shrank the content-sized tab. The element must stay mounted in both focus states;
    // whether it is visually shown when active is a separate styling concern.
    const { container } = render(<Tab {...defaultProps} isActive={true} indicator="actionRequired" />);
    expect(container.querySelector('.tab-indicator')).not.toBeNull();
  });

  it('should not render indicator when indicator is null', () => {
    render(<Tab {...defaultProps} indicator={null} />);
    expect(screen.queryByTitle('Action required')).toBeNull();
    expect(screen.queryByTitle('Feedback pending')).toBeNull();
    expect(screen.queryByTitle('Workflow running')).toBeNull();
  });

  it('should include accessible aria-label on the indicator', () => {
    render(<Tab {...defaultProps} indicator="actionRequired" />);
    const indicator = screen.getByTitle('Action required');
    expect(indicator.getAttribute('aria-label')).toBe('Action required');
  });
});
