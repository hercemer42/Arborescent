import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from '../MenuBar';
import { Menu } from '../Menu';
import { MenuItem } from '../MenuItem';
import { MenuSeparator } from '../MenuSeparator';
import { useMenuBarStore } from '../store';

// Helper to render MenuItem within Menu and MenuBar
function renderMenuItem(props: Parameters<typeof MenuItem>[0]) {
  useMenuBarStore.setState({ openMenuId: 'test' });
  return render(
    <MenuBar>
      <Menu id="test" label="Test">
        <MenuItem {...props} />
      </Menu>
    </MenuBar>
  );
}

describe('MenuItem', () => {
  beforeEach(() => {
    useMenuBarStore.setState({ openMenuId: null });
  });

  describe('rendering', () => {
    it('should render label', () => {
      renderMenuItem({ label: 'Undo' });

      expect(screen.getByText('Undo')).toBeDefined();
    });

    it('should render shortcut when provided', () => {
      renderMenuItem({ label: 'Undo', shortcut: 'Ctrl+Z' });

      expect(screen.getByText('Ctrl+Z')).toBeDefined();
    });

    it('should not render shortcut when not provided', () => {
      const { container } = renderMenuItem({ label: 'Undo' });

      const shortcut = container.querySelector('.menu-item-shortcut');
      expect(shortcut).toBeNull();
    });

    it('should have menuitem role', () => {
      renderMenuItem({ label: 'Undo' });

      expect(screen.getByRole('menuitem')).toBeDefined();
    });

    it('should have tabIndex -1', () => {
      renderMenuItem({ label: 'Undo' });

      const item = screen.getByRole('menuitem');
      expect(item.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      renderMenuItem({ label: 'Undo', disabled: true });

      const item = screen.getByRole('menuitem');
      expect(item).toHaveProperty('disabled', true);
    });

    it('should not call onClick when disabled', () => {
      const onClick = vi.fn();
      renderMenuItem({ label: 'Undo', disabled: true, onClick });

      const item = screen.getByRole('menuitem');
      fireEvent.click(item);

      expect(onClick).not.toHaveBeenCalled();
    });

    it('should not close menu when disabled item is clicked', () => {
      renderMenuItem({ label: 'Undo', disabled: true });

      const item = screen.getByRole('menuitem');
      fireEvent.click(item);

      expect(useMenuBarStore.getState().openMenuId).toBe('test');
    });
  });

  describe('danger state', () => {
    it('should apply danger class when danger prop is true', () => {
      renderMenuItem({ label: 'Delete', danger: true });

      const item = screen.getByRole('menuitem');
      expect(item.className).toContain('danger');
    });

    it('should not apply danger class when danger prop is false', () => {
      renderMenuItem({ label: 'Undo' });

      const item = screen.getByRole('menuitem');
      expect(item.className).not.toContain('danger');
    });
  });

  describe('click behavior', () => {
    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      renderMenuItem({ label: 'Undo', onClick });

      const item = screen.getByRole('menuitem');
      fireEvent.click(item);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should close menu when clicked', () => {
      const onClick = vi.fn();
      renderMenuItem({ label: 'Undo', onClick });

      const item = screen.getByRole('menuitem');
      fireEvent.click(item);

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });

    it('should close menu even without onClick handler', () => {
      renderMenuItem({ label: 'Undo' });

      const item = screen.getByRole('menuitem');
      fireEvent.click(item);

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });
  });

  describe('keyboard behavior', () => {
    it('should call onClick on Enter key', () => {
      const onClick = vi.fn();
      renderMenuItem({ label: 'Undo', onClick });

      const item = screen.getByRole('menuitem');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick on Space key', () => {
      const onClick = vi.fn();
      renderMenuItem({ label: 'Undo', onClick });

      const item = screen.getByRole('menuitem');
      fireEvent.keyDown(item, { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should close menu on Enter key', () => {
      renderMenuItem({ label: 'Undo' });

      const item = screen.getByRole('menuitem');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });

    it('should not trigger on other keys', () => {
      const onClick = vi.fn();
      renderMenuItem({ label: 'Undo', onClick });

      const item = screen.getByRole('menuitem');
      fireEvent.keyDown(item, { key: 'a' });
      fireEvent.keyDown(item, { key: 'Tab' });

      expect(onClick).not.toHaveBeenCalled();
    });
  });
});

describe('MenuSeparator', () => {
  beforeEach(() => {
    useMenuBarStore.setState({ openMenuId: 'test' });
  });

  it('should render with separator role', () => {
    render(
      <MenuBar>
        <Menu id="test" label="Test">
          <MenuItem label="Item 1" />
          <MenuSeparator />
          <MenuItem label="Item 2" />
        </Menu>
      </MenuBar>
    );

    expect(screen.getByRole('separator')).toBeDefined();
  });

  it('should have menu-separator class', () => {
    const { container } = render(
      <MenuBar>
        <Menu id="test" label="Test">
          <MenuSeparator />
        </Menu>
      </MenuBar>
    );

    const separator = container.querySelector('.menu-separator');
    expect(separator).toBeDefined();
  });
});
