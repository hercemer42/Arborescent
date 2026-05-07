import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeGutter } from '../NodeGutter';

describe('NodeGutter', () => {
  it('should render gutter element', () => {
    const mockOnToggle = vi.fn();
    const { container } = render(
      <NodeGutter
        hasChildren={false}
        expanded={true}
        onToggle={mockOnToggle}
      />
    );

    expect(container.querySelector('.node-gutter')).toBeInTheDocument();
  });

  it('should render expand toggle when node has children', () => {
    const mockOnToggle = vi.fn();
    render(
      <NodeGutter
        hasChildren={true}
        expanded={true}
        onToggle={mockOnToggle}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('⌄'); // Expanded chevron
  });

  it('should not render expand toggle when node has no children', () => {
    const mockOnToggle = vi.fn();
    const { container } = render(
      <NodeGutter
        hasChildren={false}
        expanded={true}
        onToggle={mockOnToggle}
      />
    );

    const button = container.querySelector('button');
    expect(button).not.toBeInTheDocument();
  });

  it('should show collapsed chevron when node is collapsed', () => {
    const mockOnToggle = vi.fn();
    render(
      <NodeGutter
        hasChildren={true}
        expanded={false}
        onToggle={mockOnToggle}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('›'); // Collapsed chevron
    expect(button).toHaveClass('collapsed');
  });

  it('should show expanded chevron when node is expanded', () => {
    const mockOnToggle = vi.fn();
    render(
      <NodeGutter
        hasChildren={true}
        expanded={true}
        onToggle={mockOnToggle}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('⌄'); // Expanded chevron
    expect(button).toHaveClass('expanded');
  });

  it('should call onToggle when chevron is clicked', async () => {
    const user = userEvent.setup();
    const mockOnToggle = vi.fn();
    render(
      <NodeGutter
        hasChildren={true}
        expanded={true}
        onToggle={mockOnToggle}
      />
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  describe('applied context indicator', () => {
    it('should render applied context icon when appliedContext is provided', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false }}
        />
      );

      const indicator = container.querySelector('.gutter-context-indicator.context-applied');
      expect(indicator).toBeInTheDocument();
      expect(indicator?.querySelector('svg')).toBeInTheDocument();
    });

    it('should not render applied context icon when not provided', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
        />
      );

      expect(container.querySelector('.gutter-context-indicator')).not.toBeInTheDocument();
    });

    it('should render applied context icon alongside chevron', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={true}
          expanded={true}
          onToggle={mockOnToggle}
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false }}
        />
      );

      expect(container.querySelector('.gutter-context-indicator.context-applied')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('should show tooltip on hover with applied context info', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false }}
        />
      );

      const indicator = container.querySelector('.gutter-context-indicator');
      if (indicator) fireEvent.mouseEnter(indicator);
      expect(screen.getByText('Applied context:')).toBeInTheDocument();
      expect(screen.getByText('My Context')).toBeInTheDocument();
    });
  });

  describe('context declaration with applied context', () => {
    it('should render .context-applied not .context-bundle when declaration has applied context', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false }}
        />
      );

      expect(container.querySelector('.gutter-context-indicator.context-applied')).toBeInTheDocument();
      expect(container.querySelector('.gutter-context-indicator.context-bundle')).not.toBeInTheDocument();
    });
  });

  describe('no declaration-specific rendering in gutter', () => {
    it('should not render any gutter indicator when only appliedContext is absent', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
        />
      );

      expect(container.querySelector('.gutter-context-indicator')).not.toBeInTheDocument();
    });

    it('should not render .context-bundle class', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false }}
        />
      );

      expect(container.querySelector('.context-bundle')).not.toBeInTheDocument();
    });

    it('should not render .context-declaration class', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context', collaborate: true, execute: false }}
        />
      );

      expect(container.querySelector('.context-declaration')).not.toBeInTheDocument();
    });
  });
});
