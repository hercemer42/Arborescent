import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Menu } from 'electron';
import { createApplicationMenu } from '../menuService';

vi.mock('electron', () => ({
  Menu: {
    setApplicationMenu: vi.fn(),
  },
}));

describe('menuService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createApplicationMenu', () => {
    it('should remove the application menu by setting it to null', () => {
      createApplicationMenu();

      expect(Menu.setApplicationMenu).toHaveBeenCalledWith(null);
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        createApplicationMenu();
        createApplicationMenu();
      }).not.toThrow();
    });
  });
});
