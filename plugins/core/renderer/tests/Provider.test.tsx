import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// Unmock modules that have local mocks in this test (globally mocked in setup.ts)
vi.unmock('../Provider');
vi.unmock('../Registry');

import { PluginProvider } from '../Provider';
import { PluginManager } from '../Manager';
import { PluginRegistry } from '../Registry';
import { registerPlugins, disposePlugins } from '../initializePlugins';
import { logger } from '../../../../src/renderer/services/logger';

vi.mock('../initializePlugins', () => ({
  registerPlugins: vi.fn(),
  disposePlugins: vi.fn(),
}));

vi.mock('../Manager', () => ({
  PluginManager: {
    initializePlugins: vi.fn(),
  },
}));

vi.mock('../Registry', () => ({
  PluginRegistry: {
    disposeAll: vi.fn(),
  },
}));

vi.mock('../../../../src/renderer/services/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('PluginProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(registerPlugins).mockResolvedValue(undefined);
    vi.mocked(PluginManager.initializePlugins).mockResolvedValue(undefined);
    vi.mocked(disposePlugins).mockResolvedValue(undefined);
    vi.mocked(PluginRegistry.disposeAll).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render children', () => {
    const { getByText } = render(
      <PluginProvider>
        <div>Test Content</div>
      </PluginProvider>
    );

    expect(getByText('Test Content')).toBeDefined();
  });

  it('should call registerPlugins on mount', async () => {
    render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalled();
    });
  });

  it('should call initializePlugins after registerPlugins', async () => {
    const callOrder: string[] = [];

    vi.mocked(registerPlugins).mockImplementation(async () => {
      callOrder.push('register');
    });
    vi.mocked(PluginManager.initializePlugins).mockImplementation(async () => {
      callOrder.push('initialize');
    });

    render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(callOrder).toEqual(['register', 'initialize']);
    });
  });

  it('should log error when registerPlugins fails', async () => {
    const error = new Error('Failed to register');
    vi.mocked(registerPlugins).mockRejectedValue(error);

    render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize plugins',
        error,
        'Plugin Provider'
      );
    });
  });

  it('should log error when initializePlugins fails', async () => {
    const error = new Error('Failed to initialize');
    vi.mocked(PluginManager.initializePlugins).mockRejectedValue(error);

    render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize plugins',
        error,
        'Plugin Provider'
      );
    });
  });

  it('should not initialize if component unmounts during registration', async () => {
    let resolveRegister: () => void;
    const registerPromise = new Promise<void>(resolve => {
      resolveRegister = resolve;
    });
    vi.mocked(registerPlugins).mockReturnValue(registerPromise);

    const { unmount } = render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    // Unmount before registration completes
    unmount();
    resolveRegister!();

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalled();
    });

    // Should not call initializePlugins
    expect(PluginManager.initializePlugins).not.toHaveBeenCalled();
  });

  it('should dispose plugins on unmount', async () => {
    const { unmount } = render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(PluginRegistry.disposeAll).toHaveBeenCalled();
      expect(disposePlugins).toHaveBeenCalled();
    });
  });

  it('should log error when disposePlugins fails', async () => {
    const error = new Error('Failed to dispose');
    vi.mocked(disposePlugins).mockRejectedValue(error);

    const { unmount } = render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to dispose plugins',
        error,
        'Plugin Provider'
      );
    });
  });

  it('should call disposePlugins before disposeAll', async () => {
    const callOrder: string[] = [];

    vi.mocked(PluginRegistry.disposeAll).mockImplementation(async () => {
      callOrder.push('registry-dispose');
    });
    vi.mocked(disposePlugins).mockImplementation(async () => {
      callOrder.push('manager-dispose');
    });

    const { unmount } = render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(callOrder).toContain('registry-dispose');
      expect(callOrder).toContain('manager-dispose');
      // disposeAll is called first (synchronously)
      expect(callOrder[0]).toBe('registry-dispose');
    });
  });

  it('should handle multiple mounts and unmounts', async () => {
    const { unmount: unmount1 } = render(
      <PluginProvider>
        <div>Content 1</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalledTimes(1);
    });

    unmount1();

    vi.clearAllMocks();

    const { unmount: unmount2 } = render(
      <PluginProvider>
        <div>Content 2</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalledTimes(1);
    });

    unmount2();

    await waitFor(() => {
      expect(disposePlugins).toHaveBeenCalled();
    });
  });

  it('should only initialize once per mount', async () => {
    render(
      <PluginProvider>
        <div>Content</div>
      </PluginProvider>
    );

    await waitFor(() => {
      expect(registerPlugins).toHaveBeenCalledTimes(1);
      expect(PluginManager.initializePlugins).toHaveBeenCalledTimes(1);
    });
  });
});
