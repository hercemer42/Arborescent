import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { exportNodeAsMarkdown } from '../../utils/markdown';
import { executeInTerminal as executeInTerminalUtil } from '../../services/terminalExecution';
import { createTerminal as createTerminalService } from '../../services/terminalService';
import { logger } from '../../services/logger';

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shellCommand: string;
  shellArgs: string[];
}

interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;

  // Actions
  addTerminal: (terminal: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
  sendNodeToTerminal: (node: TreeNode, nodes: Record<string, TreeNode>) => Promise<void>;
  executeNodeInTerminal: (node: TreeNode, nodes: Record<string, TreeNode>) => Promise<void>;
  createNewTerminal: (title?: string) => Promise<void>;
  closeTerminal: (id: string) => Promise<void>;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTerminalId: null,

  addTerminal: (terminal: TerminalInfo) => {
    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.id,
    }));
  },

  removeTerminal: (id: string) =>
    set((state) => {
      const newTerminals = state.terminals.filter((t) => t.id !== id);
      const newActiveId =
        state.activeTerminalId === id
          ? newTerminals[0]?.id || null
          : state.activeTerminalId;

      return {
        terminals: newTerminals,
        activeTerminalId: newActiveId,
      };
    }),

  setActiveTerminal: (id: string | null) =>
    set({ activeTerminalId: id }),

  updateTerminal: (id: string, updates: Partial<TerminalInfo>) =>
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  sendNodeToTerminal: async (node: TreeNode, nodes: Record<string, TreeNode>) => {
    const { activeTerminalId } = get();
    if (!activeTerminalId) {
      logger.error('No active terminal', new Error('No terminal selected'), 'TerminalStore');
      return;
    }

    try {
      const formattedContent = exportNodeAsMarkdown(node, nodes);
      await window.electron.terminalWrite(activeTerminalId, formattedContent + '\n');
      logger.info('Sent content to terminal', 'TerminalStore');
    } catch (error) {
      logger.error('Failed to send to terminal', error as Error, 'TerminalStore');
    }
  },

  executeNodeInTerminal: async (node: TreeNode, nodes: Record<string, TreeNode>) => {
    const { activeTerminalId } = get();
    if (!activeTerminalId) {
      logger.error('No active terminal', new Error('No terminal selected'), 'TerminalStore');
      return;
    }

    try {
      const formattedContent = exportNodeAsMarkdown(node, nodes);
      await executeInTerminalUtil(activeTerminalId, formattedContent);
      logger.info('Executed content in terminal', 'TerminalStore');
    } catch (error) {
      logger.error('Failed to execute in terminal', error as Error, 'TerminalStore');
    }
  },

  createNewTerminal: async (title = 'Terminal') => {
    try {
      const terminalInfo = await createTerminalService(title);
      get().addTerminal(terminalInfo);
      logger.info(`Created new terminal: ${terminalInfo.id}`, 'TerminalStore');
    } catch (error) {
      logger.error('Failed to create terminal', error as Error, 'TerminalStore');
    }
  },

  closeTerminal: async (id: string) => {
    try {
      await window.electron.terminalDestroy(id);
      get().removeTerminal(id);
      logger.info(`Closed terminal: ${id}`, 'TerminalStore');
    } catch (error) {
      logger.error('Failed to close terminal', error as Error, 'TerminalStore');
    }
  },
}));
