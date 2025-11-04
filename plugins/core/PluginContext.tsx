import { useEffect, useState } from 'react';
import { PluginRegistry } from './PluginRegistry';

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initPlugins() {
      try {
        await PluginRegistry.initializeAll();
      } catch (error) {
        console.error('Failed to initialize plugins:', error);
      } finally {
        setLoading(false);
      }
    }

    initPlugins();

    return () => {
      PluginRegistry.disposeAll();
    };
  }, []);

  if (loading) {
    return null;
  }

  return <>{children}</>;
}
