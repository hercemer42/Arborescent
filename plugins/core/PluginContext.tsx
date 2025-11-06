import { useEffect } from 'react';
import { PluginRegistry } from './PluginRegistry';
import { initializePlugins, disposePlugins } from './initializePlugins';
import { logger } from '../../src/renderer/services/logger';

export function PluginProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let mounted = true;

    async function initPlugins() {
      try {
        await initializePlugins();
        if (!mounted) return;
        await PluginRegistry.initializeAll();
      } catch (error) {
        logger.error('Failed to initialize plugins', error as Error, 'Plugin Provider');
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
