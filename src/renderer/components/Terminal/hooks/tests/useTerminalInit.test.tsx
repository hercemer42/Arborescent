import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Terminal as XTermCtor } from '@xterm/xterm';
import { Terminal } from '../../Terminal';
import { logger } from '../../../../services/logger';

// PR2 — terminal init is unstallable (bounded fallback poll), idempotent, and
// records time-from-open-to-first-render. The poll uses setTimeout, so these
// tests fake only setTimeout/clearTimeout and leave the synchronous rAF stub and
// real performance.now() in place.

const resizeObserverInstances: Array<{ callback: ResizeObserverCallback }> = [];

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
    focus: vi.fn(),
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

describe('useTerminal — init reliability and instrumentation (PR2)', () => {
  function renderTerminal(id: string) {
    const result = render(<Terminal id={id} />);
    const div = result.container.querySelector('.terminal-container')!;
    const rect = {
      width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0,
      toJSON: () => ({}),
    };
    vi.spyOn(div, 'getBoundingClientRect').mockImplementation(() => rect as DOMRect);
    return { ...result, setSize: (w: number, h: number) => { rect.width = w; rect.height = h; } };
  }

  function fireResizeObserver() {
    act(() => {
      resizeObserverInstances[0]?.callback([], null!);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resizeObserverInstances.length = 0;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    window.electron = {
      ...window.electron,
      terminalResize: vi.fn().mockResolvedValue(undefined),
      terminalWrite: vi.fn().mockResolvedValue(undefined),
      onTerminalData: vi.fn().mockReturnValue(vi.fn()),
      onTerminalExit: vi.fn().mockReturnValue(vi.fn()),
      getTerminalBufferedOutput: vi.fn().mockResolvedValue({ data: '', endOffset: 0 }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mounts xterm via the bounded poll when no ResizeObserver callback fires', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setSize } = renderTerminal('t1');
    expect(vi.mocked(XTermCtor)).not.toHaveBeenCalled();

    setSize(800, 600);
    act(() => { vi.advanceTimersByTime(120); });

    expect(vi.mocked(XTermCtor)).toHaveBeenCalledTimes(1);
  });

  it('stops the poll once mounted — no further init attempts', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setSize } = renderTerminal('t1');
    setSize(800, 600);
    act(() => { vi.advanceTimersByTime(120); });
    expect(vi.mocked(XTermCtor)).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(vi.mocked(XTermCtor)).toHaveBeenCalledTimes(1);
  });

  it('does not double-init when both the ResizeObserver and the poll are eligible', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { setSize } = renderTerminal('t1');
    setSize(800, 600);

    fireResizeObserver();
    expect(vi.mocked(XTermCtor)).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(500); });
    expect(vi.mocked(XTermCtor)).toHaveBeenCalledTimes(1);
  });

  it('does not poll or mount while the container stays zero-size (hidden tab)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderTerminal('t1'); // size stays 0

    act(() => { vi.advanceTimersByTime(1000); });

    expect(vi.mocked(XTermCtor)).not.toHaveBeenCalled();
  });

  it('records the time from open to first render via the logger', () => {
    const debugSpy = vi.spyOn(logger, 'debug');
    const { setSize } = renderTerminal('t-metric');
    setSize(800, 600);

    fireResizeObserver();

    const firstRenderLog = debugSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('t-metric') && c[0].includes('first render'),
    );
    expect(firstRenderLog).toBeDefined();
    expect(firstRenderLog?.[1]).toBe('Terminal');
  });

  it('logs the first-render time exactly once, not again on later resizes', () => {
    const debugSpy = vi.spyOn(logger, 'debug');
    const { setSize } = renderTerminal('t1');
    setSize(800, 600);
    fireResizeObserver();
    fireResizeObserver();

    const firstRenderLogs = debugSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('first render'),
    );
    expect(firstRenderLogs).toHaveLength(1);
  });

  it.todo('errors a visible-but-stuck pane after the init deadline (needs faked performance.now)');
});
