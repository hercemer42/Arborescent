import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';

// Mock child components
vi.mock('../components/Toast', () => ({
  ToastContainer: ({ toasts, onRemove }: { toasts: unknown[]; onRemove: (id: string) => void }) => (
    <div data-testid="toast-container">
      {(toasts as Array<{ id: string; message: string }>).map((toast) => (
        <div key={toast.id} onClick={() => onRemove(toast.id)}>
          {toast.message}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/Workspace', () => ({
  Workspace: () => <div data-testid="workspace">Workspace</div>,
}));

vi.mock('../components/MenuBar', () => ({
  AppMenuBar: () => <div data-testid="menubar">MenuBar</div>,
}));

vi.mock('../useAppErrorHandling', () => ({
  useAppErrorHandling: vi.fn(),
}));

// Mock stores - use vi.hoisted to ensure these are defined before vi.mock calls
const {
  mockInitializeSession,
  mockToasts,
  filesStoreState,
  toastStoreState,
  browserStoreState,
  panelStoreState,
} = vi.hoisted(() => {
  const mockInitializeSession = vi.fn();
  const mockToasts: { id: string; message: string; type: string }[] = [];
  const mockRemoveToast = vi.fn();
  const mockRestoreBrowserSession = vi.fn();
  const mockRestorePanelSession = vi.fn();

  const filesStoreState = {
    actions: { initializeSession: mockInitializeSession },
  };
  const toastStoreState = {
    toasts: mockToasts,
    removeToast: mockRemoveToast,
  };
  const browserStoreState = {
    tabs: [],
    activeTabId: null,
    actions: { restoreSession: mockRestoreBrowserSession },
  };
  const panelStoreState = {
    restoreSession: mockRestorePanelSession,
  };

  return {
    mockInitializeSession,
    mockToasts,
    filesStoreState,
    toastStoreState,
    browserStoreState,
    panelStoreState,
  };
});

vi.mock('../store/files/filesStore', () => {
  const useFilesStoreMock = Object.assign(
    vi.fn((selector: (s: typeof filesStoreState) => unknown) => selector(filesStoreState)),
    { getState: () => filesStoreState }
  );
  return { useFilesStore: useFilesStoreMock };
});

vi.mock('../store/toast/toastStore', () => {
  const useToastStoreMock = Object.assign(
    vi.fn((selector: (s: typeof toastStoreState) => unknown) => selector(toastStoreState)),
    { getState: () => toastStoreState }
  );
  return { useToastStore: useToastStoreMock };
});

vi.mock('../store/browser/browserStore', () => {
  const useBrowserStoreMock = Object.assign(
    vi.fn((selector?: (s: typeof browserStoreState) => unknown) =>
      selector ? selector(browserStoreState) : browserStoreState
    ),
    { getState: () => browserStoreState }
  );
  return { useBrowserStore: useBrowserStoreMock };
});

vi.mock('../store/panel/panelStore', () => {
  const usePanelStoreMock = Object.assign(
    vi.fn((selector: (s: typeof panelStoreState) => unknown) => selector(panelStoreState)),
    { getState: () => panelStoreState }
  );
  return { usePanelStore: usePanelStoreMock };
});

import { useAppErrorHandling } from '../useAppErrorHandling';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitializeSession.mockResolvedValue(undefined);
  });

  it('should render app container', async () => {
    const { container } = render(<App />);

    // App should render with the app class
    expect(container.querySelector('.app')).toBeDefined();

    // Wait for initialization to complete to avoid act warnings
    await waitFor(() => expect(mockInitializeSession).toHaveBeenCalled());
  });

  it('should call initializeSession on mount', async () => {
    render(<App />);

    expect(mockInitializeSession).toHaveBeenCalledTimes(1);

    // Wait for initialization to complete
    await waitFor(() => expect(screen.getByTestId('workspace')).toBeDefined());
  });

  it('should call useAppErrorHandling', async () => {
    render(<App />);

    expect(useAppErrorHandling).toHaveBeenCalled();

    // Wait for initialization to complete
    await waitFor(() => expect(mockInitializeSession).toHaveBeenCalled());
  });

  it('should render ToastContainer', async () => {
    render(<App />);

    expect(screen.getByTestId('toast-container')).toBeDefined();

    // Wait for initialization to complete
    await waitFor(() => expect(mockInitializeSession).toHaveBeenCalled());
  });

  it('should not show Workspace while initializing', () => {
    // Make initializeSession never resolve
    mockInitializeSession.mockImplementation(() => new Promise(() => {}));

    render(<App />);

    expect(screen.queryByTestId('workspace')).toBeNull();
  });

  it('should show Workspace after initialization completes', async () => {
    render(<App />);

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('workspace')).toBeDefined();
    });
  });

  it('should show Workspace and log error if initialization fails', async () => {
    // Mock logger to verify error is logged
    const mockLogger = await import('../services/logger');
    const loggerErrorSpy = vi.spyOn(mockLogger.logger, 'error').mockImplementation(() => {});

    mockInitializeSession.mockRejectedValue(new Error('Init failed'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('workspace')).toBeDefined();
    });

    // Verify error was logged
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize session',
      expect.any(Error),
      'App'
    );

    loggerErrorSpy.mockRestore();
  });

  it('should pass toasts and removeToast to ToastContainer', async () => {
    mockToasts.length = 0;
    mockToasts.push({ id: '1', message: 'Test toast', type: 'info' });

    render(<App />);

    const container = screen.getByTestId('toast-container');
    expect(container.textContent).toContain('Test toast');

    // Wait for initialization to complete
    await waitFor(() => expect(mockInitializeSession).toHaveBeenCalled());
  });

  it('should render with no toasts', async () => {
    mockToasts.length = 0;

    render(<App />);

    const container = screen.getByTestId('toast-container');
    expect(container.children).toHaveLength(0);

    // Wait for initialization to complete
    await waitFor(() => expect(mockInitializeSession).toHaveBeenCalled());
  });
});
