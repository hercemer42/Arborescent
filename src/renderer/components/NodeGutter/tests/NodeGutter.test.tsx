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
});
