import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Terminal } from '../Terminal';

// PR2 — the terminal pane shows a loading state until first render and an error
// state if init throws, instead of an indefinite silent blank pane.

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

const xtermControl = vi.hoisted(() => ({ openThrows: false }));

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(() => {
      if (xtermControl.openThrows) throw new Error('xterm open failed');
    }),
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

vi.mock('../hooks/useTerminalKeyboard', () => ({ useTerminalKeyboard: vi.fn() }));

vi.mock('../../../store/preferences/preferencesStore', () => ({
  usePreferencesStore: vi.fn((selector: (state: { theme: string }) => unknown) =>
    selector({ theme: 'light' })
  ),
}));

describe('Terminal pane loading / error state (PR2)', () => {
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
    xtermControl.openThrows = false;
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
    vi.unstubAllGlobals();
  });

  it('shows a loading indicator before the terminal first renders', () => {
    const { container } = renderTerminal('t1');
    const status = container.querySelector('.terminal-status');
    expect(status).toBeInTheDocument();
    expect(status?.textContent).toMatch(/starting/i);
  });

  it('marks the loading indicator as a polite live status for assistive tech', () => {
    const { container } = renderTerminal('t1');
    const status = container.querySelector('.terminal-status');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
  });

  it('removes the loading indicator once the terminal is ready', () => {
    const { container, setSize } = renderTerminal('t1');
    setSize(800, 600);
    fireResizeObserver();
    expect(container.querySelector('.terminal-status')).not.toBeInTheDocument();
  });

  it('shows an error state (role alert) when init throws, not an indefinite blank pane', () => {
    xtermControl.openThrows = true;
    const { container, setSize } = renderTerminal('t1');
    setSize(800, 600);
    fireResizeObserver();

    const error = container.querySelector('.terminal-status--error');
    expect(error).toBeInTheDocument();
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.getAttribute('aria-live')).toBe('assertive');
    expect(error?.textContent).toMatch(/failed/i);
  });

  it('keeps the loading indicator (not an error) while the container stays hidden', () => {
    const { container } = renderTerminal('t1'); // size stays 0
    const status = container.querySelector('.terminal-status');
    expect(status).toBeInTheDocument();
    expect(container.querySelector('.terminal-status--error')).not.toBeInTheDocument();
  });

  it.todo('does not flash the loading indicator for a terminal that mounts instantly (CSS fade delay)');
});
