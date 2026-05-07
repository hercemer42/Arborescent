import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const clipboardMock = {
  readText: vi.fn<() => string>(),
};

vi.mock('electron', () => ({
  clipboard: clipboardMock,
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const longInternalContent =
  '# Some node\n\nThis is the markdown body of a copied node, definitely longer than fifty characters.';
const longExternalContent =
  'This is an external paste, definitely longer than fifty characters, coming from outside the app.';

async function loadFreshMonitor() {
  vi.resetModules();
  const mod = await import('../clipboardMonitor');
  return mod.clipboardMonitor as typeof mod.clipboardMonitor & {
    recordSelfWrite: (content: string) => void;
  };
}

describe('ClipboardMonitor.recordSelfWrite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clipboardMock.readText.mockReset();
    clipboardMock.readText.mockReturnValue('');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses change emission when polled value matches a recorded self-write', async () => {
    const onChange = vi.fn();
    const monitor = await loadFreshMonitor();

    monitor.start(onChange);
    monitor.recordSelfWrite(longInternalContent);

    clipboardMock.readText.mockReturnValue(longInternalContent);
    vi.advanceTimersByTime(500);

    expect(onChange).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('still emits when an external paste follows a self-write with different content', async () => {
    const onChange = vi.fn();
    const monitor = await loadFreshMonitor();

    monitor.start(onChange);
    monitor.recordSelfWrite(longInternalContent);

    clipboardMock.readText.mockReturnValue(longExternalContent);
    vi.advanceTimersByTime(500);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(longExternalContent);
    monitor.stop();
  });

  it('suppresses self-writes that occur before the monitor is started', async () => {
    const onChange = vi.fn();
    const monitor = await loadFreshMonitor();

    monitor.recordSelfWrite(longInternalContent);
    clipboardMock.readText.mockReturnValue(longInternalContent);
    monitor.start(onChange);

    vi.advanceTimersByTime(500);

    expect(onChange).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('accepts an external paste of identical content as a known limitation (silently ignored)', async () => {
    const onChange = vi.fn();
    const monitor = await loadFreshMonitor();

    monitor.start(onChange);
    monitor.recordSelfWrite(longInternalContent);

    clipboardMock.readText.mockReturnValue(longInternalContent);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);

    expect(onChange).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('is a no-op when called repeatedly with the same content', async () => {
    const onChange = vi.fn();
    const monitor = await loadFreshMonitor();

    monitor.start(onChange);
    monitor.recordSelfWrite(longInternalContent);
    monitor.recordSelfWrite(longInternalContent);
    monitor.recordSelfWrite(longInternalContent);

    clipboardMock.readText.mockReturnValue(longInternalContent);
    vi.advanceTimersByTime(500);

    expect(onChange).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('handles empty-string self-writes without throwing', async () => {
    const monitor = await loadFreshMonitor();

    expect(() => monitor.recordSelfWrite('')).not.toThrow();
  });

  it('only suppresses the next emission, not subsequent unrelated changes', async () => {
    const onChange = vi.fn();
    const monitor = await loadFreshMonitor();

    monitor.start(onChange);
    monitor.recordSelfWrite(longInternalContent);

    clipboardMock.readText.mockReturnValue(longInternalContent);
    vi.advanceTimersByTime(500);
    expect(onChange).not.toHaveBeenCalled();

    clipboardMock.readText.mockReturnValue(longExternalContent);
    vi.advanceTimersByTime(500);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(longExternalContent);
    monitor.stop();
  });
});
