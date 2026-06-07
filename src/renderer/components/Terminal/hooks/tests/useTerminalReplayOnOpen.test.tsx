import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Terminal } from '../../Terminal';

// PR1 — useTerminal replays pre-attach output on a normal open.
//
// The shell can draw its prompt before useTerminal attaches its data listener,
// leaving those bytes only in the main-process buffer. The hook now fetches that
// buffer, writes it, and dedupes the live stream against the returned offset
// watermark so the prompt appears without relying on the SIGWINCH nudge and
// nothing renders twice.

const resizeObserverInstances: Array<{
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

class MockResizeObserver {
  callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverInstances.push(this);
  }
}

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    loadAddon: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    scrollToBottom: vi.fn(),
    refresh: vi.fn(),
    cols: 80,
    rows: 24,
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    options: {},
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })),
}));

vi.mock('../../../../store/preferences/preferencesStore', () => ({
  usePreferencesStore: vi.fn((selector: (state: { theme: string }) => unknown) =>
    selector({ theme: 'light' })
  ),
}));

vi.mock('../useTerminalKeyboard', () => ({ useTerminalKeyboard: vi.fn() }));

type DataListener = (data: string, endOffset?: number) => void;

describe('useTerminal — replay pre-attach output on open', () => {
  let mockTerminalResize: ReturnType<typeof vi.fn>;
  let mockTerminalWrite: ReturnType<typeof vi.fn>;
  let mockOnTerminalData: ReturnType<typeof vi.fn>;
  let mockOnTerminalExit: ReturnType<typeof vi.fn>;
  let mockGetBufferedOutput: ReturnType<typeof vi.fn>;
  let dataListener: DataListener | undefined;

  function renderWithDimensions(id: string, width = 800, height = 600) {
    const result = render(<Terminal id={id} />);
    const div = result.container.querySelector('.terminal-container')!;
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    return result;
  }

  async function triggerFirstResizeObserver() {
    await act(async () => {
      resizeObserverInstances[0]?.callback([], null!);
    });
  }

  async function flushMicrotasks() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  async function getXterm() {
    const { Terminal: XTermCtor } = await import('@xterm/xterm');
    return vi.mocked(XTermCtor).mock.results[0]?.value;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resizeObserverInstances.length = 0;
    dataListener = undefined;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    mockTerminalResize = vi.fn().mockResolvedValue(undefined);
    mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
    mockOnTerminalData = vi.fn().mockImplementation((_id: string, cb: DataListener) => {
      dataListener = cb;
      return vi.fn();
    });
    mockOnTerminalExit = vi.fn().mockReturnValue(vi.fn());
    mockGetBufferedOutput = vi.fn().mockResolvedValue({ data: '', endOffset: 0 });

    window.electron = {
      ...window.electron,
      terminalResize: mockTerminalResize,
      terminalWrite: mockTerminalWrite,
      onTerminalData: mockOnTerminalData,
      onTerminalExit: mockOnTerminalExit,
      getTerminalBufferedOutput: mockGetBufferedOutput,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the buffered output for its terminal id on init', async () => {
    renderWithDimensions('term-xyz');
    await triggerFirstResizeObserver();
    expect(mockGetBufferedOutput).toHaveBeenCalledWith('term-xyz');
  });

  it('writes the replayed buffered output so a prompt drawn before attach is visible', async () => {
    mockGetBufferedOutput.mockResolvedValue({ data: 'user@host:~$ ', endOffset: 12 });
    renderWithDimensions('term-1');
    await triggerFirstResizeObserver();
    await flushMicrotasks();
    const xterm = await getXterm();
    expect(xterm.write).toHaveBeenCalledWith('user@host:~$ ');
  });

  it('does not re-write a live chunk whose bytes were already replayed', async () => {
    mockGetBufferedOutput.mockResolvedValue({ data: 'abcdef', endOffset: 6 });
    renderWithDimensions('term-1');
    await triggerFirstResizeObserver();
    await flushMicrotasks();
    const xterm = await getXterm();

    dataListener?.('def', 6); // bytes 3..6 — fully inside the replayed range
    expect(xterm.write).toHaveBeenCalledWith('abcdef');
    expect(xterm.write).not.toHaveBeenCalledWith('def');
  });

  it('writes live data arriving after the replay watermark exactly once', async () => {
    mockGetBufferedOutput.mockResolvedValue({ data: 'abcdef', endOffset: 6 });
    renderWithDimensions('term-1');
    await triggerFirstResizeObserver();
    await flushMicrotasks();
    const xterm = await getXterm();

    dataListener?.('ghi', 9); // bytes 6..9 — strictly after the watermark
    const ghiWrites = xterm.write.mock.calls.filter((c: unknown[]) => c[0] === 'ghi');
    expect(ghiWrites).toHaveLength(1);
  });

  it('holds live data that arrives before replay resolves, then writes it after, deduped', async () => {
    let resolveBuffered!: (value: { data: string; endOffset: number }) => void;
    mockGetBufferedOutput.mockImplementation(
      () => new Promise((resolve) => { resolveBuffered = resolve; })
    );
    renderWithDimensions('term-1');
    await triggerFirstResizeObserver();
    const xterm = await getXterm();

    dataListener?.('xyz', 9); // arrives while replay is still pending — must be queued
    expect(xterm.write).not.toHaveBeenCalledWith('xyz');

    await act(async () => {
      resolveBuffered({ data: 'abcdef', endOffset: 6 });
    });
    await flushMicrotasks();

    expect(xterm.write).toHaveBeenCalledWith('abcdef');
    expect(xterm.write).toHaveBeenCalledWith('xyz');
    const replayOrder = xterm.write.mock.calls.findIndex((c: unknown[]) => c[0] === 'abcdef');
    const liveOrder = xterm.write.mock.calls.findIndex((c: unknown[]) => c[0] === 'xyz');
    expect(replayOrder).toBeLessThan(liveOrder);
  });

  it('still renders live data when the buffered-output request fails', async () => {
    mockGetBufferedOutput.mockRejectedValue(new Error('ipc failed'));
    renderWithDimensions('term-1');
    await triggerFirstResizeObserver();
    await flushMicrotasks();
    const xterm = await getXterm();

    dataListener?.('live output', 11);
    expect(xterm.write).toHaveBeenCalledWith('live output');
  });

  it('replays nothing for a fresh terminal and renders live data normally', async () => {
    mockGetBufferedOutput.mockResolvedValue({ data: '', endOffset: 0 });
    renderWithDimensions('term-1');
    await triggerFirstResizeObserver();
    await flushMicrotasks();
    const xterm = await getXterm();

    expect(xterm.write).not.toHaveBeenCalled();
    dataListener?.('$ ', 2);
    expect(xterm.write).toHaveBeenCalledWith('$ ');
  });

  it.todo('does not steal focus from the tree while writing replayed output');
  it.todo('renders replayed multi-byte escape sequences without corruption (needs a real xterm)');
});
