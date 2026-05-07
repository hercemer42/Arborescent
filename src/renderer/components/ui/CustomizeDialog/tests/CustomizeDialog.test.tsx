import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizeDialog, getIconByName, DEFAULT_CONTEXT_ICON } from '../CustomizeDialog';

describe('CustomizeDialog', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the dialog with header', () => {
    render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Customize')).toBeInTheDocument();
  });

  it('should render curated icons by default (50 icons)', () => {
    const { container } = render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const iconButtons = container.querySelectorAll('.icon-picker-item');
    expect(iconButtons.length).toBe(50);
  });

  it('should render search input', () => {
    render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByPlaceholderText('Search icons...')).toBeInTheDocument();
  });

  it('should show "More icons" button by default', () => {
    render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('More icons')).toBeInTheDocument();
  });

  it('should filter icons when searching', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CustomizeDialog
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
      <CustomizeDialog
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
      <CustomizeDialog
        selectedIcon="Star"
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const selectedButton = container.querySelector('.icon-picker-item.selected');
    expect(selectedButton).toBeInTheDocument();
    expect(selectedButton).toHaveAttribute('title', 'Star');
  });

  it('should call onSelect with icon and color when Apply is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const starButton = container.querySelector('.icon-picker-item[title="Star"]');
    expect(starButton).toBeInTheDocument();

    await user.click(starButton!);

    const applyButton = screen.getByText('Apply');
    await user.click(applyButton);

    expect(mockOnSelect).toHaveBeenCalledWith({ icon: 'Star', color: undefined });
  });

  it('should call onClose after clicking Apply', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const starButton = container.querySelector('.icon-picker-item[title="Star"]');
    await user.click(starButton!);

    const applyButton = screen.getByText('Apply');
    await user.click(applyButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CustomizeDialog
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
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking outside the dialog', () => {
    const { container } = render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const overlay = container.querySelector('.modal-overlay');
    fireEvent.mouseDown(overlay!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not call onClose when clicking inside the dialog', () => {
    const { container } = render(
      <CustomizeDialog
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    const dialog = container.querySelector('.modal-dialog');
    fireEvent.mouseDown(dialog!);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should show icon name on hover', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CustomizeDialog
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

describe('CustomizeDialog flag picker', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnCollaborate = vi.fn();
  const mockOnExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithFlags(props?: { collaborate?: boolean; execute?: boolean }) {
    return render(
      <CustomizeDialog
        selectedIcon="Star"
        showFlagsPicker
        selectedCollaborate={props?.collaborate ?? false}
        selectedExecute={props?.execute ?? false}
        onCollaborateChange={mockOnCollaborate}
        onExecuteChange={mockOnExecute}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );
  }

  it('renders two distinct checkboxes (no radio remaining)', () => {
    const { container } = renderWithFlags();
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(container.querySelector('.icon-picker-mode-toggle')).toBeNull();
    expect(container.querySelector('.icon-picker-mode-option')).toBeNull();
  });

  it('reflects current flag state for both checkboxes', () => {
    const { container } = renderWithFlags({ collaborate: true, execute: false });
    const collaborate = container.querySelector('#context-flag-collaborate') as HTMLInputElement;
    const execute = container.querySelector('#context-flag-execute') as HTMLInputElement;
    expect(collaborate.checked).toBe(true);
    expect(execute.checked).toBe(false);
  });

  it('toggling Collaborate leaves Execute untouched', async () => {
    const user = userEvent.setup();
    renderWithFlags({ collaborate: false, execute: false });
    await user.click(screen.getByLabelText(/Collaborate/i));
    expect(mockOnCollaborate).toHaveBeenCalledWith(true);
    expect(mockOnExecute).not.toHaveBeenCalled();
  });

  it('toggling Execute leaves Collaborate untouched', async () => {
    const user = userEvent.setup();
    renderWithFlags({ collaborate: false, execute: false });
    await user.click(screen.getByLabelText(/Execute/i));
    expect(mockOnExecute).toHaveBeenCalledWith(true);
    expect(mockOnCollaborate).not.toHaveBeenCalled();
  });

  it('saving with both off persists Action — onSelect receives (false, false)', async () => {
    const user = userEvent.setup();
    renderWithFlags({ collaborate: false, execute: false });
    await user.click(screen.getByText('Apply'));
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ collaborate: false, execute: false }),
    );
  });

  it('saving Both-on persists (true, true)', async () => {
    const user = userEvent.setup();
    renderWithFlags({ collaborate: true, execute: true });
    await user.click(screen.getByText('Apply'));
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ collaborate: true, execute: true }),
    );
  });

  it('saving Collaborate-only persists (true, false)', async () => {
    const user = userEvent.setup();
    renderWithFlags({ collaborate: true, execute: false });
    await user.click(screen.getByText('Apply'));
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ collaborate: true, execute: false }),
    );
  });

  it('saving Execute-only persists (false, true)', async () => {
    const user = userEvent.setup();
    renderWithFlags({ collaborate: false, execute: true });
    await user.click(screen.getByText('Apply'));
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ collaborate: false, execute: true }),
    );
  });

  it('renders the Default: Action framing copy', () => {
    renderWithFlags();
    expect(
      screen.getByText('Default: Action — AI responds however the context directs')
    ).toBeInTheDocument();
  });

  it('renders the "Also ask for:" header', () => {
    renderWithFlags();
    expect(screen.getByText('Also ask for:')).toBeInTheDocument();
  });

  it('checkbox labels describe output shape, not mode names', () => {
    renderWithFlags();
    expect(screen.getByText(/reviewable tree update/i)).toBeInTheDocument();
    expect(screen.getByText(/code or file changes/i)).toBeInTheDocument();
  });

  it('each checkbox has an associated label via htmlFor / id', () => {
    const { container } = renderWithFlags();
    const collabInput = container.querySelector('#context-flag-collaborate');
    const collabLabel = container.querySelector('label[for="context-flag-collaborate"]');
    const execInput = container.querySelector('#context-flag-execute');
    const execLabel = container.querySelector('label[for="context-flag-execute"]');
    expect(collabInput).toBeInTheDocument();
    expect(collabLabel).toBeInTheDocument();
    expect(execInput).toBeInTheDocument();
    expect(execLabel).toBeInTheDocument();
  });

  it('Space on focused checkbox toggles it', async () => {
    const user = userEvent.setup();
    const { container } = renderWithFlags({ collaborate: false, execute: false });
    const collaborate = container.querySelector('#context-flag-collaborate') as HTMLInputElement;
    collaborate.focus();
    await user.keyboard(' ');
    expect(mockOnCollaborate).toHaveBeenCalledWith(true);
  });

  it('Tab order goes Collaborate → Execute', async () => {
    const user = userEvent.setup();
    const { container } = renderWithFlags();
    const collaborate = container.querySelector('#context-flag-collaborate') as HTMLInputElement;
    const execute = container.querySelector('#context-flag-execute') as HTMLInputElement;
    collaborate.focus();
    expect(document.activeElement).toBe(collaborate);
    await user.tab();
    expect(document.activeElement).toBe(execute);
  });

  it('opening with Both-on context pre-checks both checkboxes', () => {
    const { container } = renderWithFlags({ collaborate: true, execute: true });
    const collaborate = container.querySelector('#context-flag-collaborate') as HTMLInputElement;
    const execute = container.querySelector('#context-flag-execute') as HTMLInputElement;
    expect(collaborate.checked).toBe(true);
    expect(execute.checked).toBe(true);
  });

  it('opening with Action context pre-unchecks both checkboxes', () => {
    const { container } = renderWithFlags({ collaborate: false, execute: false });
    const collaborate = container.querySelector('#context-flag-collaborate') as HTMLInputElement;
    const execute = container.querySelector('#context-flag-execute') as HTMLInputElement;
    expect(collaborate.checked).toBe(false);
    expect(execute.checked).toBe(false);
  });

  it('hides the flag picker when showFlagsPicker is false', () => {
    const { container } = render(
      <CustomizeDialog
        selectedIcon="Star"
        showFlagsPicker={false}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.querySelector('.icon-picker-flags-section')).toBeNull();
  });
});
