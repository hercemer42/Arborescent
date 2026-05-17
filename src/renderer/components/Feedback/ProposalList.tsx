import { useCallback, useState } from 'react';
import { useProposalsStore, Proposal } from '../../store/proposals/proposalsStore';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { AcceptProposalCommand } from '../../store/tree/commands/AcceptProposalCommand';
import { resolveToSourceFilePath } from '../../utils/zoomPath';
import { logger } from '../../services/logger';
import './ProposalList.css';

const EMPTY_PROPOSALS: Proposal[] = [];

function describe(proposal: Proposal): string {
  const r = proposal.request;
  switch (r.kind) {
    case 'add-child':
      return `Add child to node — ${truncate(r.content)}`;
    case 'append':
      return `Append to node — ${truncate(r.content)}`;
    case 'mark-complete':
      return `Mark node ${r.status}`;
    case 'set-content':
      return `Replace node content — ${truncate(r.content)}`;
    case 'delete':
      return `Delete node and its descendants`;
    case 'move':
      return `Move node under ${truncate(r.newParentId, 16)}`;
    case 'set-metadata':
      return `Set metadata.${r.key}`;
    case 'submit-step-output':
      return `Submit step output — ${truncate(r.content)}`;
  }
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export function ProposalList() {
  const activeFilePath = useFilesStore((s) => s.activeFilePath);
  const sourceFilePath = resolveToSourceFilePath(activeFilePath);
  const proposals = useProposalsStore((s) =>
    sourceFilePath ? s.proposalsByFile[sourceFilePath] ?? EMPTY_PROPOSALS : EMPTY_PROPOSALS,
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const handleAccept = useCallback(
    (proposal: Proposal) => {
      if (!sourceFilePath) return;
      if (pendingIds.has(proposal.id)) return;
      setPendingIds((prev) => new Set(prev).add(proposal.id));
      // Drop the proposal from the store first so a stale render of the list
      // cannot fire a second handler against the same id while executeCommand runs.
      useProposalsStore.getState().removeProposal(sourceFilePath, proposal.id);
      const store = storeManager.getStoreForFile(sourceFilePath);
      if (!store) {
        logger.warn(`accept proposal ${proposal.id}: no store for ${sourceFilePath}`, 'ProposalList');
        return;
      }
      const actions = store.getState().actions;
      const command = new AcceptProposalCommand(store, proposal, actions.autoSave);
      actions.executeCommand(command);
    },
    [sourceFilePath, pendingIds],
  );

  const handleReject = useCallback(
    (proposal: Proposal) => {
      if (!sourceFilePath) return;
      useProposalsStore.getState().removeProposal(sourceFilePath, proposal.id);
    },
    [sourceFilePath],
  );

  if (proposals.length === 0) return null;

  return (
    <div className="proposal-list" aria-live="polite">
      <div className="proposal-list-header">
        Pending proposals ({proposals.length})
      </div>
      <ul className="proposal-list-items">
        {proposals.map((proposal) => (
          <li key={proposal.id} className="proposal-item">
            <div className="proposal-item-description" aria-label={describe(proposal)}>
              {describe(proposal)}
            </div>
            <div className="proposal-item-actions">
              <button
                type="button"
                className="proposal-accept"
                onClick={() => handleAccept(proposal)}
                aria-label={`Accept proposal ${proposal.id}`}
              >
                Accept
              </button>
              <button
                type="button"
                className="proposal-reject"
                onClick={() => handleReject(proposal)}
                aria-label={`Reject proposal ${proposal.id}`}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
