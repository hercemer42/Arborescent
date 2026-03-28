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

  it('should NOT render indicator dot when tab is active', () => {
    render(<Tab {...defaultProps} isActive={true} indicator="actionRequired" />);
    expect(screen.queryByTitle('Action required')).toBeNull();
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
