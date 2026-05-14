import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Menu } from 'electron';

const { openLogFileMock } = vi.hoisted(() => ({ openLogFileMock: vi.fn() }));

vi.mock('electron', () => ({
  Menu: {
    setApplicationMenu: vi.fn(),
    buildFromTemplate: vi.fn((template) => template),
  },
  app: {
    name: 'Arborescent',
  },
  shell: {
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  openLogFile: openLogFileMock,
  getLogFilePath: vi.fn(() => '/tmp/arborescent.log'),
  setElectronModule: vi.fn(),
}));

import { createApplicationMenu } from '../menuService';

type SubMenuItem = { label?: string; click?: () => void; submenu?: SubMenuItem[]; role?: string };

function findMenuItem(
  template: SubMenuItem[],
  predicate: (item: SubMenuItem) => boolean
): SubMenuItem | null {
  for (const item of template) {
    if (predicate(item)) return item;
    if (item.submenu) {
      const found = findMenuItem(item.submenu, predicate);
      if (found) return found;
    }
  }
  return null;
}

describe('menuService — Help → Open Log', () => {
  let originalPlatform: string;

  beforeEach(() => {
    vi.clearAllMocks();
    openLogFileMock.mockReset();
    originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('exposes a Help submenu', () => {
    createApplicationMenu();

    const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0] as SubMenuItem[];
    const helpMenu = findMenuItem(template, (item) => item.label === 'Help' || item.label === '&Help');

    expect(helpMenu).not.toBeNull();
  });

  it('Help submenu contains an entry that opens the log file', () => {
    createApplicationMenu();

    const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0] as SubMenuItem[];
    const openLogEntry = findMenuItem(template, (item) => typeof item.label === 'string' && /open log/i.test(item.label));

    expect(openLogEntry).not.toBeNull();
    expect(typeof openLogEntry?.click).toBe('function');
  });

  it('clicking the Open Log entry invokes the openLogFile helper', () => {
    createApplicationMenu();

    const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0] as SubMenuItem[];
    const openLogEntry = findMenuItem(template, (item) => typeof item.label === 'string' && /open log/i.test(item.label));

    openLogEntry?.click?.();

    expect(openLogFileMock).toHaveBeenCalledTimes(1);
  });

  it('also exposes the Help submenu on non-darwin platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mockClear();

    createApplicationMenu();

    const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0] as SubMenuItem[];
    const helpMenu = findMenuItem(template, (item) => item.label === 'Help' || item.label === '&Help');

    expect(helpMenu).not.toBeNull();
  });
});
