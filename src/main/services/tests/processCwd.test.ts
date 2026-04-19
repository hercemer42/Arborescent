import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));
const { mockReadlink } = vi.hoisted(() => ({ mockReadlink: vi.fn() }));

vi.mock('child_process', () => ({
  execFile: mockExecFile,
  default: { execFile: mockExecFile },
}));
vi.mock('fs/promises', () => ({
  readlink: mockReadlink,
  default: { readlink: mockReadlink },
}));
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { processCwdReader } from '../processCwd';

function withPlatform(platform: NodeJS.Platform, fn: () => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  return fn().finally(() => {
    if (original) Object.defineProperty(process, 'platform', original);
  });
}

describe('processCwdReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse the cwd line from lsof output on darwin', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, 'p12345\nn/Users/brianfox/dev/Arborescent\n', '');
    });

    await withPlatform('darwin', async () => {
      const cwd = await processCwdReader.read(12345);
      expect(cwd).toBe('/Users/brianfox/dev/Arborescent');
      expect(mockExecFile).toHaveBeenCalledWith(
        'lsof',
        ['-a', '-d', 'cwd', '-p', '12345', '-Fn'],
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  it('should return null on darwin when lsof output has no n-prefixed line', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, 'p12345\n', '');
    });

    await withPlatform('darwin', async () => {
      const cwd = await processCwdReader.read(12345);
      expect(cwd).toBeNull();
    });
  });

  it('should return null on darwin when lsof fails', async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(new Error('lsof not found'), '', '');
    });

    await withPlatform('darwin', async () => {
      const cwd = await processCwdReader.read(12345);
      expect(cwd).toBeNull();
    });
  });

  it('should use /proc/<pid>/cwd on linux', async () => {
    mockReadlink.mockResolvedValue('/home/user/project');

    await withPlatform('linux', async () => {
      const cwd = await processCwdReader.read(12345);
      expect(cwd).toBe('/home/user/project');
      expect(mockReadlink).toHaveBeenCalledWith('/proc/12345/cwd');
    });
  });

  it('should return null on linux when readlink fails', async () => {
    mockReadlink.mockRejectedValue(new Error('ENOENT'));

    await withPlatform('linux', async () => {
      const cwd = await processCwdReader.read(12345);
      expect(cwd).toBeNull();
    });
  });

  it('should return null on unsupported platforms (e.g. win32)', async () => {
    await withPlatform('win32', async () => {
      const cwd = await processCwdReader.read(12345);
      expect(cwd).toBeNull();
      expect(mockExecFile).not.toHaveBeenCalled();
      expect(mockReadlink).not.toHaveBeenCalled();
    });
  });
});
