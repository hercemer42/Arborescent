import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
        pluginIndicators={[]}
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
        pluginIndicators={[]}
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
        pluginIndicators={[]}
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
        pluginIndicators={[]}
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
        pluginIndicators={[]}
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
        pluginIndicators={[]}
      />
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('should render plugin indicators when provided', () => {
    const mockOnToggle = vi.fn();
    const indicators = ['🤖', '✨'];

    render(
      <NodeGutter
        hasChildren={false}
        expanded={true}
        onToggle={mockOnToggle}
        pluginIndicators={indicators}
      />
    );

    expect(screen.getByText('🤖')).toBeInTheDocument();
    expect(screen.getByText('✨')).toBeInTheDocument();
  });

  it('should not render plugin indicators section when none provided', () => {
    const mockOnToggle = vi.fn();
    const { container } = render(
      <NodeGutter
        hasChildren={false}
        expanded={true}
        onToggle={mockOnToggle}
        pluginIndicators={[]}
      />
    );

    expect(container.querySelector('.gutter-plugin-indicators')).not.toBeInTheDocument();
  });

  it('should render both plugin indicators and chevron', () => {
    const mockOnToggle = vi.fn();
    const indicators = ['🤖'];

    render(
      <NodeGutter
        hasChildren={true}
        expanded={true}
        onToggle={mockOnToggle}
        pluginIndicators={indicators}
      />
    );

    expect(screen.getByText('🤖')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  describe('applied context indicator', () => {
    it('should render applied context icon when appliedContext is provided', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context' }}
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
          pluginIndicators={[]}
        />
      );

      expect(container.querySelector('.gutter-context-indicator.context-applied')).not.toBeInTheDocument();
    });

    it('should show declaration indicator when context declaration has applied context', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          isContextDeclaration={true}
          contextIcon="flag"
          appliedContext={{ icon: 'star', color: undefined, name: 'My Context' }}
        />
      );

      // Should show declaration icon with + badge (context-bundle class), not applied context
      expect(container.querySelector('.gutter-context-indicator.context-bundle')).toBeInTheDocument();
      expect(container.querySelector('.gutter-context-indicator.context-applied')).not.toBeInTheDocument();
    });
  });

  describe('context declaration indicator', () => {
    it('should render context indicator when isContextDeclaration is true', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          isContextDeclaration={true}
        />
      );

      const indicator = container.querySelector('.gutter-context-indicator');
      expect(indicator).toBeInTheDocument();
      // FontAwesome renders an SVG icon
      expect(indicator?.querySelector('svg')).toBeInTheDocument();
    });

    it('should not render context indicator when isContextDeclaration is false', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          isContextDeclaration={false}
        />
      );

      expect(container.querySelector('.gutter-context-indicator')).not.toBeInTheDocument();
    });

    it('should not render context indicator when isContextDeclaration is undefined', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
        />
      );

      expect(container.querySelector('.gutter-context-indicator')).not.toBeInTheDocument();
    });

    it('should render context indicator as span in gutter', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          isContextDeclaration={true}
        />
      );

      const indicator = container.querySelector('.gutter-context-indicator');
      expect(indicator).toBeInTheDocument();
      // Context declaration indicator in gutter is a span (not clickable, shows tooltip on hover)
      expect(indicator?.tagName.toLowerCase()).toBe('span');
    });

    it('should render context indicator alongside chevron and plugin indicators', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={true}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={['🤖']}
          isContextDeclaration={true}
        />
      );

      expect(container.querySelector('.gutter-context-indicator')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
      // Only expand toggle is a button (context indicator is now a span)
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });
  });
});
