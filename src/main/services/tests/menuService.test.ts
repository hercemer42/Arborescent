import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Menu, app } from 'electron';
import { createApplicationMenu } from '../menuService';

vi.mock('electron', () => ({
  Menu: {
    setApplicationMenu: vi.fn(),
    buildFromTemplate: vi.fn().mockReturnValue({}),
  },
  app: {
    name: 'TestApp',
  },
}));

describe('menuService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createApplicationMenu', () => {
    it('should set application menu on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      createApplicationMenu();

      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      expect(Menu.setApplicationMenu).toHaveBeenCalled();
      expect(Menu.setApplicationMenu).not.toHaveBeenCalledWith(null);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should set application menu to null on non-macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      createApplicationMenu();

      expect(Menu.setApplicationMenu).toHaveBeenCalledWith(null);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should use app name as menu label on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      createApplicationMenu();

      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: app.name }),
        ])
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        createApplicationMenu();
        createApplicationMenu();
      }).not.toThrow();
    });
  });
});
