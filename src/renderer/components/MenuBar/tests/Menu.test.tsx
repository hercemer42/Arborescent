import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from '../MenuBar';
import { Menu } from '../Menu';
import { MenuItem } from '../MenuItem';
import { useMenuBarStore } from '../store';

// Helper to render Menu within MenuBar (required for store access)
function renderMenu(menuProps?: Partial<Parameters<typeof Menu>[0]>) {
  return render(
    <MenuBar>
      <Menu id="test" label="Test Menu" {...menuProps}>
        <MenuItem label="Item 1" />
        <MenuItem label="Item 2" />
      </Menu>
    </MenuBar>
  );
}

describe('Menu', () => {
  beforeEach(() => {
    useMenuBarStore.setState({ openMenuId: null });
  });

  describe('rendering', () => {
    it('should render menu trigger with label', () => {
      renderMenu({ label: 'Edit' });

      expect(screen.getByText('Edit')).toBeDefined();
    });

    it('should not render dropdown when closed', () => {
      renderMenu();

      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('should render dropdown when open', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      expect(screen.getByRole('menu')).toBeDefined();
    });

    it('should render menu items when open', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      expect(screen.getByText('Item 1')).toBeDefined();
      expect(screen.getByText('Item 2')).toBeDefined();
    });
  });

  describe('trigger interaction', () => {
    it('should open menu on trigger click', () => {
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      fireEvent.click(trigger);

      expect(useMenuBarStore.getState().openMenuId).toBe('test');
    });

    it('should close menu on second trigger click', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      fireEvent.click(trigger);

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });

    it('should have correct aria attributes when closed', () => {
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have correct aria attributes when open', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('should apply active class when open', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      expect(trigger.className).toContain('active');
    });
  });

  describe('keyboard navigation', () => {
    it('should open menu on ArrowDown key', () => {
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      expect(useMenuBarStore.getState().openMenuId).toBe('test');
    });

    it('should open menu on Enter key', () => {
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      fireEvent.keyDown(trigger, { key: 'Enter' });

      expect(useMenuBarStore.getState().openMenuId).toBe('test');
    });

    it('should open menu on Space key', () => {
      renderMenu();

      const trigger = screen.getByText('Test Menu');
      fireEvent.keyDown(trigger, { key: ' ' });

      expect(useMenuBarStore.getState().openMenuId).toBe('test');
    });

    it('should close menu on Escape key', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });

    it('should navigate down with ArrowDown in dropdown', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const dropdown = screen.getByRole('menu');
      const items = screen.getAllByRole('menuitem');

      // Focus first item
      items[0].focus();

      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });

      expect(document.activeElement).toBe(items[1]);
    });

    it('should navigate up with ArrowUp in dropdown', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const dropdown = screen.getByRole('menu');
      const items = screen.getAllByRole('menuitem');

      // Focus second item
      items[1].focus();

      fireEvent.keyDown(dropdown, { key: 'ArrowUp' });

      expect(document.activeElement).toBe(items[0]);
    });

    it('should wrap around when navigating down past last item', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const dropdown = screen.getByRole('menu');
      const items = screen.getAllByRole('menuitem');

      // Focus last item
      items[1].focus();

      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });

      expect(document.activeElement).toBe(items[0]);
    });

    it('should wrap around when navigating up past first item', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const dropdown = screen.getByRole('menu');
      const items = screen.getAllByRole('menuitem');

      // Focus first item
      items[0].focus();

      fireEvent.keyDown(dropdown, { key: 'ArrowUp' });

      expect(document.activeElement).toBe(items[1]);
    });

    it('should jump to first item on Home key', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const dropdown = screen.getByRole('menu');
      const items = screen.getAllByRole('menuitem');

      // Focus last item
      items[1].focus();

      fireEvent.keyDown(dropdown, { key: 'Home' });

      expect(document.activeElement).toBe(items[0]);
    });

    it('should jump to last item on End key', () => {
      useMenuBarStore.setState({ openMenuId: 'test' });
      renderMenu();

      const dropdown = screen.getByRole('menu');
      const items = screen.getAllByRole('menuitem');

      // Focus first item
      items[0].focus();

      fireEvent.keyDown(dropdown, { key: 'End' });

      expect(document.activeElement).toBe(items[1]);
    });
  });

  describe('hover behavior', () => {
    it('should switch to this menu on hover when another menu is open', () => {
      // Set state before render
      useMenuBarStore.setState({ openMenuId: 'file' });

      render(
        <MenuBar>
          <Menu id="file" label="File">
            <MenuItem label="New" />
          </Menu>
          <Menu id="edit" label="Edit">
            <MenuItem label="Undo" />
          </Menu>
        </MenuBar>
      );

      // Hover over edit menu
      const editTrigger = screen.getByText('Edit').closest('.menu');
      fireEvent.mouseEnter(editTrigger!);

      expect(useMenuBarStore.getState().openMenuId).toBe('edit');
    });

    it('should not open menu on hover when no menu is open', () => {
      renderMenu();

      const menu = screen.getByText('Test Menu').closest('.menu');
      fireEvent.mouseEnter(menu!);

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      useMenuBarStore.setState({ openMenuId: 'test' });
      const { unmount } = renderMenu();

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });
});
