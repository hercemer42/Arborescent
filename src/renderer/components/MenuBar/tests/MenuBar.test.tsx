import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from '../MenuBar';
import { Menu } from '../Menu';
import { MenuItem } from '../MenuItem';
import { useMenuBarStore } from '../store';

describe('MenuBar', () => {
  beforeEach(() => {
    useMenuBarStore.setState({ openMenuId: null });
  });

  it('should render children', () => {
    render(
      <MenuBar>
        <div data-testid="child">Child content</div>
      </MenuBar>
    );

    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('should have menubar role', () => {
    const { container } = render(
      <MenuBar>
        <div>Content</div>
      </MenuBar>
    );

    const menubar = container.querySelector('[role="menubar"]');
    expect(menubar).toBeDefined();
  });

  it('should not render overlay when no menu is open', () => {
    const { container } = render(
      <MenuBar>
        <div>Content</div>
      </MenuBar>
    );

    const overlay = container.querySelector('.menu-bar-overlay');
    expect(overlay).toBeNull();
  });

  it('should render overlay when a menu is open', () => {
    useMenuBarStore.setState({ openMenuId: 'edit' });

    const { container } = render(
      <MenuBar>
        <div>Content</div>
      </MenuBar>
    );

    const overlay = container.querySelector('.menu-bar-overlay');
    expect(overlay).toBeDefined();
  });

  it('should close menu when overlay is clicked', () => {
    useMenuBarStore.setState({ openMenuId: 'edit' });

    const { container } = render(
      <MenuBar>
        <div>Content</div>
      </MenuBar>
    );

    const overlay = container.querySelector('.menu-bar-overlay');
    fireEvent.click(overlay!);

    expect(useMenuBarStore.getState().openMenuId).toBeNull();
  });

  it('should render with Menu children', () => {
    render(
      <MenuBar>
        <Menu id="edit" label="Edit">
          <MenuItem label="Undo" />
        </Menu>
      </MenuBar>
    );

    expect(screen.getByText('Edit')).toBeDefined();
  });
});
