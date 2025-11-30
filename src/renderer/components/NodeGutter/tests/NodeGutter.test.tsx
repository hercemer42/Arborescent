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
    it('should render active context icon when activeContext is provided', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          activeContext={{ icon: 'star', name: 'My Context' }}
        />
      );

      const indicator = container.querySelector('.gutter-context-indicator.context-applied');
      expect(indicator).toBeInTheDocument();
      expect(indicator?.querySelector('svg')).toBeInTheDocument();
    });

    it('should show only one active context icon even with multiple contexts', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          activeContext={{ icon: 'star', name: 'Context 1' }}
        />
      );

      // Only one indicator for active context
      const indicators = container.querySelectorAll('.gutter-context-indicator.context-applied');
      expect(indicators).toHaveLength(1);
    });

    it('should show tooltip with context name when activeContext is set', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          activeContext={{ icon: 'star', name: 'My Context' }}
        />
      );

      const indicator = container.querySelector('.gutter-context-indicator.context-applied');
      expect(indicator).toHaveAttribute('title', 'Context: My Context');
    });

    it('should show generic tooltip when activeContext name is empty', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          activeContext={{ icon: 'star', name: '' }}
        />
      );

      const indicator = container.querySelector('.gutter-context-indicator.context-applied');
      expect(indicator).toHaveAttribute('title', 'Has context applied');
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

    it('should show bundle indicator when context declaration has bundled contexts', () => {
      const mockOnToggle = vi.fn();
      const { container } = render(
        <NodeGutter
          hasChildren={false}
          expanded={true}
          onToggle={mockOnToggle}
          pluginIndicators={[]}
          isContextDeclaration={true}
          contextIcon="flag"
          bundledContexts={[{ icon: 'star', name: 'My Context' }]}
        />
      );

      // Should show bundle (cog with count) not applied context or plain declaration
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

    it('should render context indicator with tooltip', () => {
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
      expect(indicator).toHaveAttribute('title', 'Click to change icon');
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
      // Both context indicator and expand toggle are buttons
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });
});
