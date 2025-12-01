import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../services/ancestry';
import { useContextAwareSubmenu } from './useContextAwareSubmenu';

interface UseExecuteSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  hasEffectiveContext: boolean;
  onExecuteInBrowser: () => void;
  onExecuteInTerminal: () => void;
  onSetActiveContext: (nodeId: string, contextId: string) => void;
}

/**
 * Hook for generating the Execute submenu.
 * Uses shared context-aware submenu structure.
 */
export function useExecuteSubmenu({
  node,
  nodes,
  ancestorRegistry,
  hasEffectiveContext,
  onExecuteInBrowser,
  onExecuteInTerminal,
  onSetActiveContext,
}: UseExecuteSubmenuParams): ContextMenuItem[] {
  return useContextAwareSubmenu({
    node,
    nodes,
    ancestorRegistry,
    hasEffectiveContext,
    onTerminalAction: onExecuteInTerminal,
    onBrowserAction: onExecuteInBrowser,
    onSetActiveContext,
  });
}
