import { useState, useEffect } from 'react';
import { usePluginStore } from '../../../store/plugins/pluginStore';
import { TreeNode } from '../../../../shared/types';

export function usePluginIndicators(node: TreeNode | undefined) {
  const enabledPlugins = usePluginStore((state) => state.enabledPlugins);
  const [pluginIndicators, setPluginIndicators] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    if (!node) {
      setPluginIndicators([]);
      return;
    }

    async function loadPluginIndicators(nodeToLoad: TreeNode) {
      const indicators = await Promise.all(
        enabledPlugins.map(async (plugin) => {
          const result = await plugin.extensionPoints.provideNodeIndicator?.(nodeToLoad);
          return result;
        })
      );

      const rendered = indicators
        .filter((indicator) => indicator !== null)
        .map((indicator) => {
          if (indicator && typeof indicator === 'object' && 'type' in indicator && 'value' in indicator) {
            return indicator.value;
          }
          return null;
        });

      setPluginIndicators(rendered);
    }

    loadPluginIndicators(node);
  }, [node, enabledPlugins]);

  return pluginIndicators;
}
