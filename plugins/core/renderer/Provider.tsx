import { useEffect } from 'react';
import { PluginRegistry } from './Registry';
import { PluginManager } from './Manager';
import { registerPlugins, disposePlugins } from './initializePlugins';
import { logger } from '../../../src/renderer/services/logger';
import { notifyError } from '../../../src/renderer/utils/errorNotification';

/**
 * PluginProvider orchestrates the plugin system initialization in the renderer process.
 *
 * It handles the complete plugin lifecycle:
 * 1. Registration - Loads plugin manifests, registers commands, creates proxy instances
 * 2. Initialization - Triggers actual plugin initialization in the worker thread
 * 3. Disposal - Cleans up all plugins on unmount
 *
 * The plugin system uses a dual-architecture:
 * - PluginManager: Manages worker thread communication (IPC)
 * - PluginRegistry: Manages UI state (enabled/disabled status, Zustand store)
 *
 * Plugin code itself runs in an isolated worker thread for security and stability.
 */
export function PluginProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let mounted = true;

    async function initPlugins() {
      try {
        await registerPlugins();
        if (!mounted) return;
        await PluginManager.initializePlugins();
      } catch (error) {
        logger.error('Failed to initialize plugins', error as Error, 'Plugin Provider');
        notifyError(
          'Plugin system encountered an error. Check logs for details.',
          error as Error,
          'Plugin System'
        );
      }
    }

    initPlugins();

    return () => {
      mounted = false;
      PluginRegistry.disposeAll();
      disposePlugins().catch((error) => {
        logger.error('Failed to dispose plugins', error as Error, 'Plugin Provider');
      });
    };
  }, []);

  return <>{children}</>;
}
