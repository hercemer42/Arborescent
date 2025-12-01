import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconPicker, getIconByName, DEFAULT_CONTEXT_ICON } from '../IconPicker';

describe('IconPicker', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the dialog with header', () => {
    render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Choose an icon')).toBeInTheDocument();
  });

  it('should render curated icons by default (50 icons)', () => {
    const { container } = render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const iconButtons = container.querySelectorAll('.icon-picker-item');
    expect(iconButtons.length).toBe(50);
  });

  it('should render search input', () => {
    render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByPlaceholderText('Search icons...')).toBeInTheDocument();
  });

  it('should show "More icons" button by default', () => {
    render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('More icons')).toBeInTheDocument();
  });

  it('should filter icons when searching', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search icons...');
    await user.type(searchInput, 'star');

    const iconButtons = container.querySelectorAll('.icon-picker-item');
    // Should find icons containing 'star' in the name
    expect(iconButtons.length).toBeGreaterThan(0);
    expect(iconButtons.length).toBeLessThan(50);
  });

  it('should show no results message when search has no matches', async () => {
    const user = userEvent.setup();
    render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search icons...');
    await user.type(searchInput, 'xyznonexistent');

    expect(screen.getByText('No icons found')).toBeInTheDocument();
  });

  it('should highlight selected icon', () => {
    const { container } = render(
      <IconPicker
        selectedIcon="Star"
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const selectedButton = container.querySelector('.icon-picker-item.selected');
    expect(selectedButton).toBeInTheDocument();
    expect(selectedButton).toHaveAttribute('title', 'Star');
  });

  it('should call onSelect when an icon is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const starButton = container.querySelector('.icon-picker-item[title="Star"]');
    expect(starButton).toBeInTheDocument();

    await user.click(starButton!);

    expect(mockOnSelect).toHaveBeenCalledWith('Star');
  });

  it('should call onClose after selecting an icon', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const starButton = container.querySelector('.icon-picker-item[title="Star"]');
    await user.click(starButton!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByText('×');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when Escape is pressed', () => {
    render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking outside the dialog', () => {
    const { container } = render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const overlay = container.querySelector('.icon-picker-overlay');
    fireEvent.mouseDown(overlay!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not call onClose when clicking inside the dialog', () => {
    const { container } = render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const dialog = container.querySelector('.icon-picker-dialog');
    fireEvent.mouseDown(dialog!);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should show icon name on hover', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <IconPicker
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const starButton = container.querySelector('.icon-picker-item[title="Star"]');
    await user.hover(starButton!);

    expect(screen.getByText('Star')).toBeInTheDocument();
  });
});

describe('getIconByName', () => {
  it('should return icon component for valid name', () => {
    const Icon = getIconByName('Lightbulb');
    expect(Icon).not.toBeNull();
  });

  it('should return warning icon for unknown name (fallback)', () => {
    const Icon = getIconByName('old-fontawesome-icon');
    expect(Icon).not.toBeNull(); // Returns TriangleAlert as fallback
  });

  it('should return null for empty string', () => {
    const Icon = getIconByName('');
    expect(Icon).toBeNull();
  });
});

describe('DEFAULT_CONTEXT_ICON', () => {
  it('should be Lightbulb', () => {
    expect(DEFAULT_CONTEXT_ICON).toBe('Lightbulb');
  });
});
