import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ProposalPayload } from '../../../shared/types/electronApi';

export type { ProposalPayload };

export interface Proposal {
  id: string;
  sessionId: string;
  nodeId: string;
  request: ProposalPayload;
  createdAt: number;
}

interface ProposalsStoreState {
  proposalsByFile: Record<string, Proposal[]>;
  addProposal: (
    filePath: string,
    args: { sessionId: string; nodeId: string; request: ProposalPayload },
  ) => string;
  removeProposal: (filePath: string, id: string) => void;
  getProposalsForFile: (filePath: string) => Proposal[];
  clearForSession: (sessionId: string) => void;
  clearForFile: (filePath: string) => void;
}

const EMPTY: Proposal[] = [];

export const useProposalsStore = create<ProposalsStoreState>((set, get) => ({
  proposalsByFile: {},

  addProposal(filePath, args) {
    const id = uuidv4();
    const proposal: Proposal = {
      id,
      sessionId: args.sessionId,
      nodeId: args.nodeId,
      request: args.request,
      createdAt: Date.now(),
    };
    set((state) => {
      const existing = state.proposalsByFile[filePath] ?? [];
      return {
        proposalsByFile: {
          ...state.proposalsByFile,
          [filePath]: [...existing, proposal],
        },
      };
    });
    return id;
  },

  removeProposal(filePath, id) {
    set((state) => {
      const existing = state.proposalsByFile[filePath];
      if (!existing) return state;
      const filtered = existing.filter((p) => p.id !== id);
      if (filtered.length === existing.length) return state;
      return {
        proposalsByFile: { ...state.proposalsByFile, [filePath]: filtered },
      };
    });
  },

  getProposalsForFile(filePath) {
    return get().proposalsByFile[filePath] ?? EMPTY;
  },

  clearForSession(sessionId) {
    set((state) => {
      const next: Record<string, Proposal[]> = {};
      let changed = false;
      for (const [filePath, list] of Object.entries(state.proposalsByFile)) {
        const filtered = list.filter((p) => p.sessionId !== sessionId);
        if (filtered.length !== list.length) changed = true;
        next[filePath] = filtered;
      }
      return changed ? { proposalsByFile: next } : state;
    });
  },

  clearForFile(filePath) {
    set((state) => {
      if (!(filePath in state.proposalsByFile)) return state;
      const next = { ...state.proposalsByFile };
      delete next[filePath];
      return { proposalsByFile: next };
    });
  },
}));
