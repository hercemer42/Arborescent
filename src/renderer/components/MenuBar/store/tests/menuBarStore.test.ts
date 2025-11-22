import { describe, it, expect, beforeEach } from 'vitest';
import { useMenuBarStore } from '../menuBarStore';

describe('menuBarStore', () => {
  beforeEach(() => {
    useMenuBarStore.setState({ openMenuId: null });
  });

  describe('initial state', () => {
    it('should have no menu open initially', () => {
      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });
  });

  describe('setOpenMenuId', () => {
    it('should set the open menu id', () => {
      const { setOpenMenuId } = useMenuBarStore.getState();

      setOpenMenuId('edit');

      expect(useMenuBarStore.getState().openMenuId).toBe('edit');
    });

    it('should allow changing to a different menu', () => {
      const { setOpenMenuId } = useMenuBarStore.getState();

      setOpenMenuId('edit');
      setOpenMenuId('file');

      expect(useMenuBarStore.getState().openMenuId).toBe('file');
    });

    it('should allow setting to null', () => {
      const { setOpenMenuId } = useMenuBarStore.getState();

      setOpenMenuId('edit');
      setOpenMenuId(null);

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });
  });

  describe('closeMenu', () => {
    it('should close the open menu', () => {
      const { setOpenMenuId, closeMenu } = useMenuBarStore.getState();

      setOpenMenuId('edit');
      closeMenu();

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });

    it('should be safe to call when no menu is open', () => {
      const { closeMenu } = useMenuBarStore.getState();

      closeMenu();

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });
  });
});
