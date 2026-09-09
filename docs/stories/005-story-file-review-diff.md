# A proposed story revision reviews as an inline diff

Depends on [004](004-in-tree-markdown-editor.md).

## 📄 Product spec

### Context

Tree content already has a review loop: a session proposes, the change renders inline as a diff, the user edits it if needed and accepts.
Story content moving to files loses that.
A session asked to revise a story has nowhere to put the revision except the file itself, which would mean the change lands unreviewed — the opposite of how every other AI change in the app is handled.

The user is the sole developer, reviewing a revision the session proposed to a spec they wrote, usually while the workflow that produced it is still running in the terminal.

Reviewing in the GitHub UI after the fact is the fallback, and it is worse in two ways: it happens after the change has landed, and it moves the user out of the app they are orchestrating from.

### Goal

Let a proposed revision to a story file render as an inline diff under its node, editable and acceptable in place, so file content reviews the way tree content already does.

### Business rules

1. A submission targeting a file-link node is a file review; the step-output applier branches on the target's kind, treating the content as raw file text for a file link and as a heading tree otherwise.
2. A file review is keyed on the file-link node, so it inherits the existing reviews map, the exclusivity rules and the overlap gate without a parallel lifecycle.
3. Opening a file review opens the reviewed node in a background zoom tab without taking focus, exactly as a tree review does today.
4. A file review never expands the region in the main view, because several reviews can be open at once and the user may be working in the panel; the main-view node keeps whatever collapsed state it had.
5. The coloured review control bar renders above the node as for any review, so a collapsed node still shows that a review is waiting.
6. Expanding the region during a review shows a unified inline diff rather than the plain source: deletions rendered inline, changed regions highlighted, and unchanged regions collapsed.
7. Changes are highlighted at word level within a line, because a reworded business rule is a single long line and a line-level diff would mark the whole thing as changed and say nothing.
8. Individual chunks can be accepted or rejected without accepting the whole revision.
9. The document stays editable during review, so wording can be fixed in place before accepting rather than in a follow-up edit.
10. Accepting writes the file, subject to the same on-disk comparison story 004 uses, and refuses rather than clobbering an external change.
11. Accepting uses a command of its own rather than the existing tree accept, whose accept modes, archive configuration, step-history integration and status preservation are all tree-specific.
12. Rejecting discards the proposal and leaves the file untouched.
13. A session re-submitting a revised proposal for the same node refreshes the region rather than being refused, which requires a same-node replace-in-place carve-out in the overlap gate.
14. A file review is subject to the same one-review-per-node rule as a tree review; a second session proposing to the same file waits rather than opening a concurrent review.

### Acceptance criteria

#### Happy path

- [ ] A submission targeting a file-link node opens a file review, a background zoom tab, and the control bar above the node.
- [ ] The main-view node stays collapsed, and focus does not move.
- [ ] Expanding the region shows a unified diff with deletions inline and unchanged regions collapsed.
- [ ] A reworded rule shows word-level highlighting inside the changed line rather than the whole line marked as changed.
- [ ] Accepting one chunk applies it and leaves the others pending.
- [ ] Editing the proposed text during review and then accepting writes the edited version, not the original proposal.
- [ ] Accepting writes the file and clears the review.
- [ ] Rejecting clears the review and leaves the file byte-identical.

#### Edge cases

- [ ] The file changing on disk during review makes accept refuse with the same blocked-write behaviour as story 004, and the proposal is not lost.
- [ ] A re-submission for the same node refreshes the region rather than being refused by the overlap gate.
- [ ] A second session proposing to the same file while a review is open is refused with a retryable message.
- [ ] A proposal whose content is identical to the file opens a review reporting no changes rather than an empty diff.
- [ ] Deleting the file during review makes accept refuse and name the missing path.
- [ ] Deleting the file-link node during review clears the review rather than leaving an orphan.
- [ ] A tree review on an ancestor and a file review on a descendant file link follow the existing overlap rules unchanged.
- [ ] Collapsing the region mid-review leaves the review open and the control bar visible.

#### Non-functional

- [ ] A revision touching three paragraphs of a 500-line story renders as three hunks, not the whole file.
- [ ] This story adds no new dependency.

---

## 🔧 Implementation proposal

### Approach

The region built in story 004 gains a second mode.
With no review it holds plain source; with a review it holds a unified merge view seeded with the file's current content as the baseline and the proposal as the document.
The editor dependency already supports this, so the diff is a configuration of the component rather than a second one.

Routing is where the work is.
The submission path currently assumes tree content: the applier parses the submitted string as a heading tree.
It gains a branch on the target node's kind, and for a file link it hands the raw text to the file review instead.
Keying the review on the file-link node means the reviews map, the exclusivity check and the overlap gate need no change beyond the replace-in-place carve-out.

Accept is a sibling command to the tree accept, sharing nothing with it but the review lifecycle it reports into.

### Touchpoints

- **Step-output applier** — the branch on target kind, and the raw-text path for a file link.
- **Review store** — a review kind discriminator so the region knows which mode to render; no change to keying, exclusivity or overlap.
- **Overlap gate** — the same-node replace-in-place carve-out that lets a re-submission refresh an open review.
- **Region component** — the diff mode, chunk controls, and word-level highlighting configuration.
- **Accept command** — a new command writing the file, reusing story 004's disk-state comparison and refusal.
- **Tests** — applier routing by target kind, review keying and overlap behaviour, re-submission refresh, chunk accept, edit-then-accept, and accept refusal on external change.

### Constraints to call out

- The replace-in-place carve-out is a pre-existing gap rather than something this story invents: re-submitting mid-review is blocked by the overlap gate today. Revising a story is a common move, so the carve-out becomes load-bearing here rather than optional.
- The existing tree accept command must not be widened to handle files. Its accept modes, archive path, step-history integration and status preservation are all tree semantics, and a file accept shares none of them.
- Rule 4 is deliberate and should not be relaxed into auto-expanding for discoverability. The background zoom tab is the discoverability mechanism, and expanding in the main view would shift layout under a user who may be reading something else.
- The baseline is the file on disk when the review opens, not the last committed version. Arborescent stays unaware of git.

### Out of scope

Reviewing a file that no node links; diffing two arbitrary versions; diffing against a git revision; rendered-markdown diffs; merging two concurrent proposals.
