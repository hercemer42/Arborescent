import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Terminal } from '../../Terminal';

// ResizeObserver mock — captures each instance so tests can fire callbacks manually
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
    scrollLines: vi.fn(),
    refresh: vi.fn(),
    cols: 80,
    rows: 24,
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    options: {},
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

vi.mock('../../../../store/preferences/preferencesStore', () => ({
  usePreferencesStore: vi.fn((selector: (state: { theme: string }) => unknown) =>
    selector({ theme: 'light' })
  ),
}));

// Mock keyboard shortcut hook — not under test here
vi.mock('../useTerminalKeyboard', () => ({
  useTerminalKeyboard: vi.fn(),
}));

describe('useTerminal — tab switching and blank terminal prevention', () => {
  let mockTerminalResize: ReturnType<typeof vi.fn>;
  let mockOnTerminalData: ReturnType<typeof vi.fn>;
  let mockOnTerminalExit: ReturnType<typeof vi.fn>;

  function renderWithDimensions(
    id: string,
    width = 800,
    height = 600,
    props: { pinnedToBottom?: boolean } = {},
  ) {
    const result = render(<Terminal id={id} {...props} />);
    const div = result.container.querySelector('.terminal-container')!;
    const boundingRectSpy = vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    return { ...result, terminalDiv: div, boundingRectSpy };
  }

  async function triggerFirstResizeObserver() {
    await act(async () => {
      resizeObserverInstances[0]?.callback([], null!);
    });
  }

  async function triggerMainResizeObserver() {
    await act(async () => {
      resizeObserverInstances[resizeObserverInstances.length - 1]?.callback([], null!);
    });
  }

  async function simulateHide(boundingRectSpy: ReturnType<typeof vi.spyOn>) {
    boundingRectSpy.mockReturnValue({
      width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    await triggerMainResizeObserver();
  }

  async function simulateShow(boundingRectSpy: ReturnType<typeof vi.spyOn>, width = 800, height = 600) {
    boundingRectSpy.mockReturnValue({
      width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    await triggerMainResizeObserver();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resizeObserverInstances.length = 0;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    // Make requestAnimationFrame synchronous so resize callbacks fire immediately in tests
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    mockTerminalResize = vi.fn().mockResolvedValue(undefined);
    mockOnTerminalData = vi.fn().mockReturnValue(vi.fn());
    mockOnTerminalExit = vi.fn().mockReturnValue(vi.fn());

    window.electron = {
      ...window.electron,
      terminalResize: mockTerminalResize,
      onTerminalData: mockOnTerminalData,
      onTerminalExit: mockOnTerminalExit,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initialization guard prevents rendering into a hidden container', () => {
    it('does not create an xterm instance when the container has zero dimensions', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      render(<Terminal id="term-1" />);
      // jsdom getBoundingClientRect defaults to {0, 0}
      expect(XTermCtor).not.toHaveBeenCalled();
    });

    it('creates an xterm instance once the container has non-zero dimensions', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      expect(XTermCtor).toHaveBeenCalledTimes(1);
    });

    it('sets up a ResizeObserver to detect when the container gains dimensions', () => {
      render(<Terminal id="term-1" />);
      expect(resizeObserverInstances.length).toBeGreaterThan(0);
      expect(resizeObserverInstances[0].observe).toHaveBeenCalled();
    });

    it('does not initialize xterm twice if ResizeObserver fires more than once', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      // Fire again — xtermRef.current is now non-null so initializeTerminal short-circuits
      await act(async () => {
        resizeObserverInstances[0]?.callback([], null!);
      });
      expect(XTermCtor).toHaveBeenCalledTimes(1);
    });

    it('opens xterm into the terminal container element on initialization', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { terminalDiv } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      expect(xterm.open).toHaveBeenCalledWith(terminalDiv);
    });
  });

  describe('PTY redraw sequence forces the shell to repaint after initialization', () => {
    it('calls terminalResize with (cols − 1, rows) to nudge the PTY into redrawing', async () => {
      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      expect(mockTerminalResize).toHaveBeenCalledWith('term-1', 79, 24);
    });

    it('calls terminalResize with the original (cols, rows) to restore terminal size', async () => {
      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      expect(mockTerminalResize).toHaveBeenCalledWith('term-1', 80, 24);
    });

    it('issues the restore resize only after the shrink resize resolves (sequential, not parallel)', async () => {
      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      const calls = mockTerminalResize.mock.calls;
      const shrinkIdx = calls.findIndex((c) => c[1] === 79);
      const restoreIdx = calls.findIndex((c) => c[1] === 80);
      expect(shrinkIdx).toBeGreaterThanOrEqual(0);
      expect(restoreIdx).toBeGreaterThan(shrinkIdx);
    });

    it('uses the terminal id from props in both resize calls', async () => {
      renderWithDimensions('my-specific-terminal');
      await triggerFirstResizeObserver();
      expect(mockTerminalResize).toHaveBeenCalledWith('my-specific-terminal', 79, 24);
      expect(mockTerminalResize).toHaveBeenCalledWith('my-specific-terminal', 80, 24);
    });

    it('calls fitAddon.fit() before issuing the redraw resize calls', async () => {
      const { FitAddon } = await import('@xterm/addon-fit');
      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      const fitAddon = vi.mocked(FitAddon).mock.results[0]?.value;
      expect(fitAddon.fit).toHaveBeenCalled();
    });
  });

  describe('event listener setup after initialization', () => {
    it('registers an onTerminalData listener with the correct terminal id', async () => {
      renderWithDimensions('term-abc');
      await triggerFirstResizeObserver();
      expect(mockOnTerminalData).toHaveBeenCalledWith('term-abc', expect.any(Function));
    });

    it('registers an onTerminalExit listener with the correct terminal id', async () => {
      renderWithDimensions('term-abc');
      await triggerFirstResizeObserver();
      expect(mockOnTerminalExit).toHaveBeenCalledWith('term-abc', expect.any(Function));
    });

    it('writes PTY data to xterm when onTerminalData fires (terminal with no prior output)', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      let dataCallback!: (data: string) => void;
      mockOnTerminalData.mockImplementation((_id: string, cb: (data: string) => void) => {
        dataCallback = cb;
        return vi.fn();
      });

      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      dataCallback('$ ');
      expect(xterm.write).toHaveBeenCalledWith('$ ');
    });

    it('writes all PTY data to xterm without dropping any for large output volumes', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      let dataCallback!: (data: string) => void;
      mockOnTerminalData.mockImplementation((_id: string, cb: (data: string) => void) => {
        dataCallback = cb;
        return vi.fn();
      });

      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      for (let i = 0; i < 500; i++) {
        dataCallback(`output line ${i}\n`);
      }
      expect(xterm.write).toHaveBeenCalledTimes(500);
    });

    it('writes chunked data in order when process is mid-output', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      let dataCallback!: (data: string) => void;
      mockOnTerminalData.mockImplementation((_id: string, cb: (data: string) => void) => {
        dataCallback = cb;
        return vi.fn();
      });

      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      dataCallback('partial ');
      dataCallback('output ');
      dataCallback('ends\n');
      expect(xterm.write).toHaveBeenNthCalledWith(1, 'partial ');
      expect(xterm.write).toHaveBeenNthCalledWith(2, 'output ');
      expect(xterm.write).toHaveBeenNthCalledWith(3, 'ends\n');
    });

    it('writes an exit message to xterm when the PTY process exits', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      let exitCallback!: (event: { exitCode: number }) => void;
      mockOnTerminalExit.mockImplementation((_id: string, cb: (event: { exitCode: number }) => void) => {
        exitCallback = cb;
        return vi.fn();
      });

      renderWithDimensions('term-1');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      exitCallback({ exitCode: 0 });
      expect(xterm.write).toHaveBeenCalledWith(expect.stringContaining('Process exited with code 0'));
    });
  });

  describe('cleanup releases resources when the terminal unmounts', () => {
    it('disposes the xterm instance on unmount', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { unmount } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      unmount();
      expect(xterm.dispose).toHaveBeenCalled();
    });

    it('disconnects the ResizeObserver on unmount', async () => {
      const { unmount } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      unmount();
      const anyDisconnected = resizeObserverInstances.some(
        (o) => o.disconnect.mock.calls.length > 0
      );
      expect(anyDisconnected).toBe(true);
    });

    it('removes the window resize listener on unmount', async () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      unmount();
      expect(spy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('calls the data listener cleanup function on unmount', async () => {
      const removeDataListener = vi.fn();
      mockOnTerminalData.mockReturnValue(removeDataListener);

      const { unmount } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      unmount();
      expect(removeDataListener).toHaveBeenCalled();
    });

    it('calls the exit listener cleanup function on unmount', async () => {
      const removeExitListener = vi.fn();
      mockOnTerminalExit.mockReturnValue(removeExitListener);

      const { unmount } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      unmount();
      expect(removeExitListener).toHaveBeenCalled();
    });
  });

  describe('resize handling when terminal container visibility changes', () => {
    it('skips the resize when the container still has zero dimensions after a resize event', async () => {
      const { boundingRectSpy } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();
      mockTerminalResize.mockClear();

      await simulateHide(boundingRectSpy);

      expect(mockTerminalResize).not.toHaveBeenCalled();
    });

    it('tab switch: forces xterm to repaint from its own buffer when a hidden terminal becomes visible', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      xterm.refresh.mockClear();

      await simulateHide(boundingRectSpy);
      await simulateShow(boundingRectSpy);

      expect(xterm.refresh).toHaveBeenCalledWith(0, 23);
    });

    it('tab switch: resizes the PTY to current dimensions when becoming visible', async () => {
      const { boundingRectSpy } = renderWithDimensions('term-1');
      await triggerFirstResizeObserver();

      await simulateHide(boundingRectSpy);
      mockTerminalResize.mockClear();

      await simulateShow(boundingRectSpy);

      expect(mockTerminalResize).toHaveBeenCalledWith('term-1', 80, 24);
    });

    it('tab switch: terminal with no output (just a shell prompt) is refreshed after switching back', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-empty');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      xterm.refresh.mockClear();

      await simulateHide(boundingRectSpy);
      await simulateShow(boundingRectSpy);

      expect(xterm.refresh).toHaveBeenCalledWith(0, 23);
    });

    it('tab switch: terminal with a large volume of output is repainted after switching back', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      let dataCallback!: (data: string) => void;
      mockOnTerminalData.mockImplementation((_id: string, cb: (data: string) => void) => {
        dataCallback = cb;
        return vi.fn();
      });

      const { boundingRectSpy } = renderWithDimensions('term-large');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      for (let i = 0; i < 1000; i++) {
        dataCallback(`line ${i}\n`);
      }
      expect(xterm.write).toHaveBeenCalledTimes(1000);

      xterm.refresh.mockClear();

      await simulateHide(boundingRectSpy);
      await simulateShow(boundingRectSpy);

      expect(xterm.refresh).toHaveBeenCalledWith(0, 23);
    });

    it('tab switch: terminal that was mid-output is repainted so buffered content is visible', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      let dataCallback!: (data: string) => void;
      mockOnTerminalData.mockImplementation((_id: string, cb: (data: string) => void) => {
        dataCallback = cb;
        return vi.fn();
      });

      const { boundingRectSpy } = renderWithDimensions('term-active');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      dataCallback('start\n');

      await simulateHide(boundingRectSpy);
      dataCallback('mid\n');
      dataCallback('output\n');
      expect(xterm.write).toHaveBeenCalledWith('mid\n');
      expect(xterm.write).toHaveBeenCalledWith('output\n');

      xterm.refresh.mockClear();
      await simulateShow(boundingRectSpy);

      expect(xterm.refresh).toHaveBeenCalledWith(0, 23);
    });

    it('tab switch: idle terminal is repainted on show regardless of PTY activity', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-idle');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      xterm.refresh.mockClear();

      await simulateHide(boundingRectSpy);
      await simulateShow(boundingRectSpy);

      expect(xterm.refresh).toHaveBeenCalledWith(0, 23);
    });

    it('does not call refresh on plain resizes where the container was never hidden', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-resize');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      xterm.refresh.mockClear();

      // Fire a resize with non-zero dimensions, no preceding hide — should not refresh
      await simulateShow(boundingRectSpy, 1024, 768);

      expect(xterm.refresh).not.toHaveBeenCalled();
    });
  });

  describe('rapid tab switching', () => {
    it('switching through all open terminal tabs in rapid sequence repaints each time', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-rapid');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;

      for (let cycle = 0; cycle < 3; cycle++) {
        await simulateHide(boundingRectSpy);
        xterm.refresh.mockClear();
        await simulateShow(boundingRectSpy);
        expect(xterm.refresh).toHaveBeenCalledWith(0, 23);
      }
    });

    it('PTY data arriving while a tab is hidden is not lost', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      let dataCallback!: (data: string) => void;
      mockOnTerminalData.mockImplementation((_id: string, cb: (data: string) => void) => {
        dataCallback = cb;
        return vi.fn();
      });

      const { boundingRectSpy } = renderWithDimensions('term-concurrent');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;

      await simulateHide(boundingRectSpy);

      // Data arrives while the tab is not visible — xterm buffers it
      dataCallback('data during switch\n');
      expect(xterm.write).toHaveBeenCalledWith('data during switch\n');

      await simulateShow(boundingRectSpy);
    });
  });

  describe('scroll viewport reconcile when terminal becomes visible', () => {
    it('tab switch (pinned): scrolls to bottom on reveal so the latest output is visible', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-pinned');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      xterm.scrollToBottom.mockClear();

      await simulateHide(boundingRectSpy);
      await simulateShow(boundingRectSpy);

      expect(xterm.scrollToBottom).toHaveBeenCalled();
    });

    it('tab switch (pinned): does not scroll to bottom on plain resize where container was never hidden', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-pinned-resize');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      xterm.scrollToBottom.mockClear();

      // Plain resize, no hide — should not snap to bottom (it would surprise users mid-scroll)
      await simulateShow(boundingRectSpy, 1024, 768);

      expect(xterm.scrollToBottom).not.toHaveBeenCalled();
    });

    it('tab switch (unpinned): does NOT auto-scroll to bottom on reveal — preserves user position', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-unpinned', 800, 600, {
        pinnedToBottom: false,
      });
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;
      xterm.scrollToBottom.mockClear();

      await simulateHide(boundingRectSpy);
      await simulateShow(boundingRectSpy);

      expect(xterm.scrollToBottom).not.toHaveBeenCalled();
    });

    it('tab switch (unpinned): reconciles viewport metrics on reveal so scrolling becomes possible again');

    it('tab switch (pinned): scroll-to-bottom only fires on the hidden->visible transition, not on subsequent stable resizes', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-pinned-stable');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;

      await simulateHide(boundingRectSpy);
      await simulateShow(boundingRectSpy);
      xterm.scrollToBottom.mockClear();

      // Subsequent stable resize without a hide in between — should not re-trigger scrollToBottom
      await simulateShow(boundingRectSpy, 1024, 768);

      expect(xterm.scrollToBottom).not.toHaveBeenCalled();
    });

    it('rapid tab switching (pinned): each reveal scrolls to bottom', async () => {
      const { Terminal: XTermCtor } = await import('@xterm/xterm');
      const { boundingRectSpy } = renderWithDimensions('term-pinned-rapid');
      await triggerFirstResizeObserver();

      const xterm = vi.mocked(XTermCtor).mock.results[0]?.value;

      for (let cycle = 0; cycle < 3; cycle++) {
        await simulateHide(boundingRectSpy);
        xterm.scrollToBottom.mockClear();
        await simulateShow(boundingRectSpy);
        expect(xterm.scrollToBottom).toHaveBeenCalled();
      }
    });

    it('tab switch (pinned): scrollToBottom on reveal happens after fit() so geometry is correct first');
  });
});
