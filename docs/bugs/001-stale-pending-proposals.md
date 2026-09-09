# A persisted review proposal is re-offered indefinitely, with no staleness check against the node it targets

## Summary

Opening a `.arbo` file restores every persisted review proposal as a live review regardless of its age or whether its captured baseline still matches the node, so an accept can silently revert unrelated edits made since the proposal was captured.

## Steps to reproduce

1. Precondition: a file with a pending review proposal on some node — a submission that was left unresolved rather than accepted or rejected.
2. Edit that node's subtree over the following days or weeks, and reopen the file several times.
3. Open the file again and accept the review that appears.
4. Observe that the accept applies the proposal's captured subtree, discarding the edits made since capture, and that nothing in the UI indicated the proposal was old or that its baseline had moved.

## Expected behaviour

- A restored proposal whose captured baseline no longer matches the current node is presented as stale, naming when it was captured, so the accept is an informed choice rather than a blind one.
- The diff shown for a restored proposal is honest about what it will overwrite, rather than rendering as though it were captured against the node's current content.
- A proposal beyond some age, or whose baseline has diverged, is not silently offered as an ordinary pending review.
- Resolving a restored proposal is final: it does not reappear on the next open.

## Actual behaviour

`restoreCollaborationState` restores every persisted proposal whose reviewed node still exists, and drops only those whose node has been deleted outright. Age is not considered and the captured baseline is not compared against the node.

The user-visible symptom is a review that looks freshly submitted. Accepting it replaces the node's subtree with content captured against a version of that subtree that may be weeks old, and the intervening edits are gone with no warning. In the observed case two proposals from 2026-07-08 and 2026-08-12 were still being re-offered on 2026-08-21, both carrying content from a different project — one would have replaced the `AI refactor` context with a Forest Admin validator invocation, the other would have added Forest's backend jest and test-database setup to the testing context.

## Suspected cause

`restoreCollaborationState` in `src/renderer/store/tree/actions/sendActions.ts:755-780` filters the persisted map on one condition only — whether `nodes[candidate.reviewedNodeId]` still exists. Everything surviving that check becomes a restored review.

The information needed for a staleness check is already persisted and simply unread. `capturedAt` is stamped on every entry at `src/renderer/store/tree/pendingProposals/pendingProposals.ts:18` and typed at `src/shared/types/pendingProposal.ts:9`, but its only reader in the codebase is the step-history tooltip at `src/renderer/components/NodeContent/hooks/useWorkflowSubmenu.ts:42-64`. Each proposal node also carries `feedbackPriorContent`, the content it was captured against, which would make a baseline comparison a direct equality check rather than an inference.

The existing guard misses this case because it was written for a different failure: a proposal pointing at a node that has been deleted. A node that still exists but has changed underneath the proposal passes that check cleanly.

## Affected files

- `src/renderer/store/tree/actions/sendActions.ts` — the restore path and its orphan filter, primary suspect.
- `src/renderer/store/tree/pendingProposals/pendingProposals.ts` — where `capturedAt` is stamped and never consulted.
- `src/renderer/components/TreeNode/TreeNode.tsx` — reads `feedbackPriorContent` for change-kind rendering, so it is where a stale baseline would be surfaced in the diff.
- `src/renderer/store/tree/commands/acceptFeedbackStrategies.ts` — strips the baseline metadata on accept, so nothing records what the accept overwrote.

## Regression window

Present since `29cb95e` "feat: persist inline review proposals in the .arbo instead of temp files", which introduced the persisted map, on top of `591eb64` "feat: review AI proposals concurrently with overlap gating". Before that change proposals lived in temp files and did not survive as durably, so the unbounded lifetime is new with the `.arbo`-native map. First observed 2026-08-21; latest release is v0.2.0.

## Severity

Medium-to-high on impact, low on frequency. It causes silent data loss of committed work rather than a visible error, and the loss is proportional to how long the proposal sat unresolved. It requires a proposal to be left unresolved, which is uncommon, but nothing signals that one is accumulating and no upper bound exists on how long it persists.

## Notes

- Not the same failure as the orphan case the current filter handles, and not the same as the overlap-gate blocking of a mid-review re-send noted in `docs/stories/005-story-file-review-diff.md`. That one refuses a *new* proposal on a node under review; this one accepts an *old* one too readily.
- A related hazard sits one step away: two `.arbo` files that share node ids — a working copy of a project file, for instance — each hold their own persisted map keyed by the same ids, so a proposal captured in one is structurally valid in the other. Neither file is wrong on its own, but the ids no longer identify a unique target across open files.
- The gap worth closing alongside is diagnostic rather than behavioural: nothing tells the user a file has unresolved proposals waiting, so one can sit for weeks without ever being noticed. A count in the status bar or the activity log at file-open would have surfaced both of these long before they were accepted.
- Both observed proposals contained another project's content, which suggests they arrived by copying context subtrees between files rather than by being submitted here. Whatever the route, it is what turned a stale-diff problem into a cross-project contamination problem.
