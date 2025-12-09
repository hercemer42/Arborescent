import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { vol } from 'memfs';
import { registerIpcHandlers } from '../ipcService';
import { logger } from '../logger';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
  clipboard: {
    readText: vi.fn(() => ''),
  },
}));

// Mock node:fs using memfs
vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    default: memfs.fs,
    ...memfs.fs,
    promises: memfs.fs.promises,
  };
});

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    default: actual,
    join: vi.fn((...args: string[]) => args.join('/')),
  };
});

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ipcService', () => {
  let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
  let mockWindow: BrowserWindow | null;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();
    mockWindow = {} as BrowserWindow;

    // Reset memfs
    vol.reset();

    // Capture IPC handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler);
    });
  });

  describe('registerIpcHandlers', () => {
    it('should register all IPC handlers', async () => {
      await registerIpcHandlers(() => mockWindow);

      expect(ipcMain.handle).toHaveBeenCalledWith('read-file', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('write-file', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('show-open-dialog', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('show-save-dialog', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('get-temp-dir', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('create-temp-file', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('delete-temp-file', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('list-temp-files', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('show-unsaved-changes-dialog', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('save-session', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('get-session', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('save-temp-files-metadata', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('get-temp-files-metadata', expect.any(Function));
    });
  });

  describe('read-file handler', () => {
    it('should read file content successfully', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('read-file')!;

      // Create virtual file using memfs
      vol.fromJSON({ '/path/to/file.txt': 'file content' });

      const result = await handler({}, '/path/to/file.txt');

      expect(result).toBe('file content');
      expect(logger.info).toHaveBeenCalledWith('File read: /path/to/file.txt', 'IPC');
    });

    it('should handle read file errors', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('read-file')!;

      // File doesn't exist in memfs

      await expect(handler({}, '/path/to/nonexistent.txt')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to read file: /path/to/nonexistent.txt',
        expect.any(Error),
        'IPC',
        true
      );
    });
  });

  describe('write-file handler', () => {
    it('should write file content successfully', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('write-file')!;

      // Create parent directory in memfs
      vol.mkdirSync('/path/to', { recursive: true });

      await handler({}, '/path/to/file.txt', 'content');

      // Verify file was written to memfs
      expect(vol.readFileSync('/path/to/file.txt', 'utf-8')).toBe('content');
      expect(logger.info).toHaveBeenCalledWith('File written: /path/to/file.txt', 'IPC');
    });
  });

  describe('show-open-dialog handler', () => {
    it('should show open dialog with main window', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-open-dialog')!;

      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/selected/file.json'],
      });

      const result = await handler();

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Arborescent Files', extensions: ['arbo'] }],
      });
      expect(result).toBe('/selected/file.json');
    });

    it('should return null when dialog is canceled', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-open-dialog')!;

      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await handler();

      expect(result).toBeNull();
    });
  });

  describe('show-save-dialog handler', () => {
    it('should return file path with .arbo extension when user provides it', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-save-dialog')!;

      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: '/path/to/file.arbo',
      });

      const result = await handler();

      expect(result).toBe('/path/to/file.arbo');
    });

    it('should add .arbo extension when user does not provide it', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-save-dialog')!;

      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: '/path/to/file',
      });

      const result = await handler();

      expect(result).toBe('/path/to/file.arbo');
    });

    it('should use provided default path over last saved directory', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-save-dialog')!;

      // Create parent directory in memfs
      vol.mkdirSync('/mock/user/data', { recursive: true });

      // Save with last directory stored
      vol.writeFileSync('/mock/user/data/last-save-directory.txt', '/documents/work');

      // Call with explicit default path
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: '/home/user/project.arbo',
      });

      await handler({}, '/home/user');

      // Should use provided path, not last saved directory
      expect(dialog.showSaveDialog).toHaveBeenCalledWith(mockWindow, {
        defaultPath: '/home/user',
        filters: [{ name: 'Arborescent Files', extensions: ['arbo'] }],
      });
    });

    it('should fall back to last saved directory when no default provided', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-save-dialog')!;

      // Create parent directory in memfs
      vol.mkdirSync('/mock/user/data', { recursive: true });
      vol.writeFileSync('/mock/user/data/last-save-directory.txt', '/documents/work');

      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: '/documents/work/file.arbo',
      });

      await handler({}, undefined);

      // Should use last saved directory
      expect(dialog.showSaveDialog).toHaveBeenCalledWith(mockWindow, {
        defaultPath: '/documents/work',
        filters: [{ name: 'Arborescent Files', extensions: ['arbo'] }],
      });
    });

    it('should return null when dialog is canceled', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-save-dialog')!;

      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: true,
        filePath: '',
      });

      const result = await handler();

      expect(result).toBeNull();
    });

    it('should return null when filePath is empty', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('show-save-dialog')!;

      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: '',
      });

      const result = await handler();

      expect(result).toBeNull();
    });
  });

  describe('save-session handler', () => {
    it('should save session successfully', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('save-session')!;

      // Create parent directory in memfs
      vol.mkdirSync('/mock/user/data', { recursive: true });

      await handler({}, '{"data":"test"}');

      // Verify session was written to memfs
      expect(vol.readFileSync('/mock/user/data/session.json', 'utf-8')).toBe('{"data":"test"}');
      expect(logger.info).toHaveBeenCalledWith('Session saved', 'Persistence');
    });
  });

  describe('get-session handler', () => {
    it('should get session successfully', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('get-session')!;

      // Create session file in memfs
      vol.fromJSON({ '/mock/user/data/session.json': '{"data":"test"}' });

      const result = await handler();

      expect(result).toBe('{"data":"test"}');
      expect(logger.info).toHaveBeenCalledWith('Session loaded', 'Persistence');
    });

    it('should return null when session file does not exist', async () => {
      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('get-session')!;

      const result = await handler();

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('No session file found', 'Persistence');
    });
  });

  describe('clipboard handlers', () => {
    it('should register start-clipboard-monitor handler', async () => {
      await registerIpcHandlers(() => mockWindow);

      expect(ipcMain.handle).toHaveBeenCalledWith('start-clipboard-monitor', expect.any(Function));
    });

    it('should register stop-clipboard-monitor handler', async () => {
      await registerIpcHandlers(() => mockWindow);

      expect(ipcMain.handle).toHaveBeenCalledWith('stop-clipboard-monitor', expect.any(Function));
    });

    it('should start clipboard monitor when handler is called', async () => {
      const clipboardMonitorModule = await import('../clipboardMonitor');
      const startSpy = vi.spyOn(clipboardMonitorModule.clipboardMonitor, 'start');

      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('start-clipboard-monitor')!;

      await handler();

      expect(startSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not start monitor if no window available', async () => {
      const clipboardMonitorModule = await import('../clipboardMonitor');
      const startSpy = vi.spyOn(clipboardMonitorModule.clipboardMonitor, 'start');

      await registerIpcHandlers(() => null);
      const handler = handlers.get('start-clipboard-monitor')!;

      await handler();

      expect(startSpy).not.toHaveBeenCalled();
    });

    it('should stop clipboard monitor when handler is called', async () => {
      const clipboardMonitorModule = await import('../clipboardMonitor');
      const stopSpy = vi.spyOn(clipboardMonitorModule.clipboardMonitor, 'stop');

      await registerIpcHandlers(() => mockWindow);
      const handler = handlers.get('stop-clipboard-monitor')!;

      await handler();

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should send clipboard content to renderer when detected', async () => {
      const mockWebContents = {
        send: vi.fn(),
      };
      const mockWindowWithWebContents = {
        webContents: mockWebContents,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const clipboardMonitorModule = await import('../clipboardMonitor');
      let monitorCallback: ((content: string) => void) | undefined;
      vi.spyOn(clipboardMonitorModule.clipboardMonitor, 'start').mockImplementation((callback) => {
        monitorCallback = callback;
      });

      await registerIpcHandlers(() => mockWindowWithWebContents);
      const handler = handlers.get('start-clipboard-monitor')!;

      await handler();

      // Simulate clipboard content detection
      expect(monitorCallback).toBeDefined();
      monitorCallback!('clipboard content');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'clipboard-content-detected',
        'clipboard content'
      );
    });
  });
});
