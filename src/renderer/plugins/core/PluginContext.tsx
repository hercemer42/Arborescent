import { createContext, useContext, useEffect, useState } from 'react';
import { PluginRegistry } from './PluginRegistry';
import { AIPlugin } from './pluginInterface';

interface PluginContextValue {
  plugins: AIPlugin[];
  enabledPlugins: AIPlugin[];
  loading: boolean;
}

const PluginContext = createContext<PluginContextValue | null>(null);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const [plugins, setPlugins] = useState<AIPlugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initPlugins() {
      try {
        await PluginRegistry.initializeAll();
        setPlugins(PluginRegistry.getAllPlugins());
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

  const enabledPlugins = plugins.filter((p) => p.manifest.enabled);

  return (
    <PluginContext.Provider value={{ plugins, enabledPlugins, loading }}>
      {children}
    </PluginContext.Provider>
  );
}

export function usePlugins() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugins must be used within PluginProvider');
  }
  return context;
}
