import { useEffect } from 'react';
import { PluginRegistry } from './PluginRegistry';
import { initializeBuiltinPlugins, disposeBuiltinPlugins } from './initializePlugins';
import { logger } from '../../src/renderer/services/logger';

export function PluginProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let mounted = true;

    async function initPlugins() {
      try {
        await initializeBuiltinPlugins();
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
      disposeBuiltinPlugins().catch((error) => {
        logger.error('Failed to dispose plugins', error as Error, 'Plugin Provider');
      });
    };
  }, []);

  return <>{children}</>;
}
