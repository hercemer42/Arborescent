# Debrief step writes weighted findings into a user-supplied node

## 📄 Product spec

### Context

An Arborescent workflow runs for hours, and the Claude session driving it is the only witness to what actually went wrong along the way — a step prompt that under-specified its output, a context that fought the tool gate, a code smell the session tripped over three times in one afternoon.

The user is the sole developer and sole user of Arborescent, working in a single project `.arbo` file.

Today those observations have nowhere to go.
They get hand-copied into a memory file after the fact, dropped as a child of the subject node where they die with the story once it is archived, or lost with the terminal scrollback.
Three things are wrong with that: the record is attached to the story rather than to the problem, so it is never seen again; there is no signal of recurrence, so a papercut hit six times looks identical to a one-off; and capture depends on the user's attention at the point in a long session where it is lowest.
The session already holds the observation in context and already has a write path.
Nothing collects it.

The feature is named Debrief rather than "feedback" because feedback already denotes the AI-proposition and inline-diff-review system in this codebase.
Prompts are the worst place for an ambiguous term, since the session reads both meanings.

### Goal

Let a debrief step at the end of a workflow deposit each observed problem as its own finding in a user-supplied node, linked back to the work that surfaced it, so recurrence is visible as a weight rather than reconstructed from memory.

### Vocabulary

| Term | Meaning |
| --- | --- |
| Debrief step | The workflow step that writes what the session observed |
| Findings node | The user-supplied destination node the debrief writes into |
| Finding | One issue inside the Findings node; its children are its description and its back-links |
| Back-link | A hyperlink child of a finding pointing at the subject node the debrief ran on; the unit of evidence |
| Weight | A finding's back-link count, rendered as a coloured badge in place of the checkbox |
| Register | The inventory of existing findings rendered into the debrief prompt so the session can target one by uuid |

### Business rules

1. A workflow step may declare exactly one Findings node, stored in step metadata as `debriefDestinationId` and set by pasting a node hyperlink into a new Debrief section of the step config dialog.
2. The pasted hyperlink must resolve to a node in the file being edited; a link into another file is rejected at paste time with an inline error and nothing is stored, because the direct-apply write path resolves exactly one store per session and hyperlink creation is itself same-file only.
3. Configuring a Findings node stamps `isFindingsRoot` on it, which is what makes its children render weight badges; the flag is never removed automatically, so retargeting a step leaves the previous Findings node's badges intact.
4. The debrief control is offered only on autonomous steps and is disabled with a stated reason on manual and checkpoint steps, because on those routes every tree write becomes a review proposition and the proposal receiver rejects every proposition that is not a `submit_step_output`, so the write cannot land at all.
5. Declaring a Findings node is itself the capability grant: it adds a narrow additional write allowance for `add-child` requests whose parent is inside that node's subtree, orthogonal to the context mode table, which is left untouched.
6. The grant is enforced on both the request kind and the target, so `mark_step_complete`, `move_node` and `delete_node` can never inherit it and the session can never retire or reorder a finding.
7. The grant refuses `add-child` when the parent is a hyperlink node, so nothing can accumulate beneath a back-link; this mirrors the existing user-facing refusal to nest a hyperlink under a link branch.
8. Because the grant is orthogonal to mode, a debrief step works under any context mode; mode continues to govern only the bound subtree and the step's completion channel.
9. When no Findings node is configured the send path omits the register block and raises no warning, while the config dialog marks the step incomplete so the authoring mistake surfaces where it was made.
10. When the configured Findings node does not resolve at send time the send path omits the register block, writes one Activity-log warning naming the step and the dangling id, and the step still runs; a debrief never blocks or fails a workflow.
11. Rule 10 is a correctness requirement rather than a nicety: a dangling id that does reach the session returns `Parent node <id> not found`, the session has no recovery path, it announces the step done regardless, and the entire debrief is lost silently.
12. Copying a workflow into another file must not carry a dangling destination, so `debriefDestinationId` is added to the existing cross-file reference remapper alongside `appliedContextId` and `linkedNodeId`, which already remaps a pointer when the target has a match and strips it when it does not.
13. When the Findings node resolves, the step prompt carries its node id plus the register: one line per existing finding giving that finding's node id, title and current weight.
14. Every reference in the system is by uuid — the register targets a finding by node id, a back-link targets its subject by `linkedNodeId` — so a title is a human-readable label only and renaming anything can never break targeting.
15. The register carries titles and weights only, never descriptions or back-links, because identifying which finding to update needs nothing more than the title and the id.
16. The register is neither capped nor truncated, because a title-and-weight line is small enough that a register of a hundred findings stays affordable.
17. A new finding is recorded as a single `add_child_node` under the Findings node carrying the problem title, followed by `add_child_node` calls under that finding carrying the description.
18. A recurrence is recorded against the existing finding uuid read from the register, never as a new sibling.
19. On any write into the Findings subtree during a debrief step, the app attaches a back-link — a hyperlink child of the touched finding pointing at that step's subject node — because `add_child_node` cannot set metadata and the session therefore cannot create one.
20. Attaching a back-link is idempotent: if the finding already carries a back-link to that subject node the app makes no change, so a retried, resumed or re-sent debrief step cannot inflate a weight.
21. A finding's weight is its back-link count, derived at render time and never persisted, so it cannot drift from the evidence and cannot be double-counted.
22. The app stamps `expanded: false` on a finding when it creates it, so the Findings node reads as a flat list of titles and weights with the description one keystroke away.
23. Findings and back-links render no status checkbox at all; the weight badge occupies that position, exactly as a workflow step's number already replaces the checkbox rather than sitting beside it.
24. A finding is retired by deleting it, which deletes its description and back-links with it; there is no completed or won't-fix status.
25. Weight colour bands are muted for 1–3, amber for 4–5 and red for 6 or more — the requested thresholds with the polarity corrected so severity ascends monotonically.
26. The app performs no duplicate detection, merging or rejection; sameness is the session's judgement, and a misfiled finding is repaired by hand.
27. The Findings node is a review queue and never an action list: nothing downstream reads it automatically, no finding triggers work, and weight is evidence of recurrence rather than a priority score, because a session asked to critique the tool it is running inside can produce plausible filler and a human must judge before actioning.
28. A debrief runs as the final step of a work workflow, per story, writing into a Findings node in the same `.arbo` file; there is no standalone debrief workflow and no cross-file or cross-project aggregation.
29. What counts as a finding is authored in the step's context, not in code — no category field, no auto-routing, no taxonomy.

### Acceptance criteria

#### Happy path

- [x] Pasting a node hyperlink into the Debrief section of an autonomous step stores `debriefDestinationId`, stamps `isFindingsRoot` on the target, and shows the target's content as confirmation.
- [x] Sending that step produces a prompt containing the Findings node id plus one register line per existing finding, each with uuid, title and weight.
- [x] A session creating a new finding yields a child of the Findings node whose badge reads 1, which is collapsed, carries the description it wrote, and carries one back-link to the step's subject node.
- [x] Clicking that back-link navigates to the subject node the debrief ran on.
- [x] A second story reporting the same problem against the existing finding uuid raises its badge from 1 to 2 and adds a second back-link, creating no new sibling.
- [x] The second story's register contains the findings created by the first.
- [x] The workflow advances normally after the debrief step.

#### Edge cases

- [x] Re-sending or resuming the same debrief step for the same subject node leaves every weight unchanged and adds no second back-link.
- [x] A hyperlink to a node in a different `.arbo` file is refused at paste time with an inline message and nothing is stored.
- [x] With the Findings node deleted after configuration, the step runs, the prompt contains no register block, the Activity log carries exactly one warning naming the step and the dangling id, and no `Parent node not found` error reaches the session.
- [x] A workflow copied into another file has its `debriefDestinationId` stripped rather than carried, and the pasted step reports itself as incomplete in the dialog.
- [x] A workflow copied within the same file keeps a working destination.
- [x] The debrief control is disabled with a stated reason on manual and checkpoint steps.
- [x] A debrief step under a collaborate-only context still writes its findings, proving the grant is independent of the mode table.
- [x] `add_child_node` targeting a node neither in the bound subtree nor in the granted Findings subtree is refused.
- [x] `add_child_node` targeting a back-link as its parent is refused.
- [x] `mark_step_complete`, `move_node` and `delete_node` targeting a node in the granted Findings subtree are each refused.
- [x] A register of 200 findings renders 200 title-and-weight lines with no truncation and no description text.
- [x] A finding renders its weight badge and no checkbox; a back-link renders as a hyperlink and no checkbox.
- [x] Colour bands are correct at weights 1, 3, 4, 5, 6 and 12.
- [x] Deleting a finding removes its description and back-links and leaves other weights unchanged.
- [x] Deleting the subject node a back-link points at leaves the finding and its weight intact, and the back-link degrades the way an existing dangling hyperlink already does.
- [x] Reopening the file preserves every weight, and no weight or count key appears anywhere in the saved `.arbo`.

#### Non-functional

- [x] Steps without a Findings node add zero prompt tokens.
- [x] The weight badge carries an accessible label stating the weight, since colour must not be the only carrier of the recurrence signal.

---

## 🔧 Implementation proposal

### Approach

The Findings node is a plain node in the same `.arbo` file.
Its children are findings, and a finding's children are its description plus its back-links, so weight is a child count — nothing is persisted and nothing can drift.

The session's only write is the existing `add_child_node`: a finding under the Findings node, description lines under a finding.
It never creates, edits or deletes a back-link, because `add_child_node` cannot set metadata.

The app owns the evidence.
A post-write hook on mutations landing inside a Findings subtree attaches the back-link to the touched finding and stamps `expanded: false` on a newly created finding, keyed for idempotency on `linkedNodeId` equality with the step's subject node.
Back-links need no collapse handling of their own: a node renders only its own children and a hyperlink never displays its target's subtree, so a back-link has nothing to fan open.
What it needs is the refusal to nest anything beneath it.

The capability grant replaces what would otherwise be a mode constraint.
`debriefDestinationId` on the step authorises `add-child` into that subtree, checked in the write gate alongside the existing mode allow-list rather than by widening it, so the mode table is untouched and no existing step anywhere in the app gains surface.
Autonomous-only survives for the proposal-rejection reason and is enforced both in the dialog and at the gate.

The register is rendered by the send path from the Findings node's direct children — uuid, title, weight — and injected as its own prompt block, because the session's read tools are hard-scoped to the bound node and cannot see the Findings node at all.

The badge is a new branch in the status-area dispatch, modelled on the branch a workflow step already takes: the checkbox branch is simply not reached, exactly as it is not reached for a step today.
Back-links need no new rendering; they are ordinary hyperlink nodes.

### Touchpoints

- **Shared types** — `debriefDestinationId` and `isFindingsRoot` on node metadata. No schema or migration work: `.arbo` is loaded with an unvalidated cast and metadata carries an index signature.
- **Store actions** — a `setDebriefDestination` action in the workflow actions module, cloned from the existing single-flag setters.
- **Step config dialog** — a new Debrief section plus a new generic hyperlink-paste hook carrying the same-file check, distinct inline errors for its three failure branches, and `preventDefault` on the error branches so a failed paste cannot store raw text as an id.
- **Workflow helpers** — a destination resolver in the shape of the existing archive-config resolver, looking up the parent step.
- **Send path** — a register renderer and a debrief output-target block, plus the unresolvable-destination guard routed through the existing workflow notification helper so one call yields both the Activity-log entry and the toast.
- **Renderer mutator** — the post-write hook attaching back-links and stamping collapse, sited so it sees the parent id of every applied mutation.
- **MCP write gate** — the destination-scoped grant, keyed on request kind `add-child`, on the parent being inside the granted subtree, and on the parent not being a hyperlink.
- **Node content** — the weight badge branch, a selector for "parent is a Findings root", and three colour-tier classes reusing the existing amber token.
- **Clipboard paste** — `debriefDestinationId` added to the existing cross-file reference remapper's strip list.
- **Tests** — register rendering, destination resolution, back-link idempotency across a re-sent step, badge rendering and bands, cross-file paste stripping, and gate tests asserting the `add-child` allowance plus the refusals for the other kinds and for a hyperlink parent.

### Constraints to call out

- The grant introduces a second permission axis in the write gate. That is the deliberate alternative to a fifth context mode or to mode overriding, both of which would change what every existing step resolves through — but it is the review-sensitive part of the change, and the gate must key on kind and target together or the other mutation kinds inherit it.
- Autonomous-only is mechanical, not policy: the proposal receiver rejects every non-`submit_step_output` proposition, so a manual or checkpoint debrief cannot land a write.
- The Findings node must live in the same `.arbo` file. One store per session on the direct-apply path, and hyperlink creation is same-file only, so back-links could not point across files even if the writes could.
- A Findings node parked under a context declaration loses its badges, because the context-child branch of the status area returns early with no wrapper. A dialog hint covers it rather than enforcement.
- Findings have no status, so tree-wide status semantics do not apply to them; anything that walks status across the tree must treat a Findings subtree as statusless rather than pending.
- Pre-existing and documented but not fixed here: a proposal-route add-child files the proposal against the bound node while its parent field points elsewhere, currently masked by the receiver's blanket rejection.
- Rollout ordering: the write gate lands as its own commit with its own tests before the feature that grants through it, so the permission-surface change is reviewable in isolation.

### Rejected alternatives

- A stored weight scalar. A stored counter double-increments on a retried or resumed debrief step with no way to detect it, and this codebase already carries that class of bug on the autonomous write path.
- Protecting a finding's title. It solves nothing, because every reference is by uuid, and it fights the synthesis by freezing the headline at its first sighting.
- A fifth context mode, or letting a debrief override the mode. The first changes the table every existing step resolves through; the second makes a context's declared permissions stop meaning what they say.
- A category field or auto-routing for the three example kinds of finding. Point separate steps at separate Findings nodes, or organise by hand.

### Out of scope

A dedicated findings panel or view; cross-file or cross-project registers; archive-style link-name pairs; AI-driven merging of existing findings; priority scoring; anything that actions a finding automatically.

### Complications

Risks not covered by the acceptance criteria:

- `add_child_node` returns `{applied: true}` and nothing else, and the read tools take no node argument, so the session cannot learn the uuid of the finding it just created and cannot hang a description under it. Rule 17's title-then-description flow does not execute as written. `applyAddChild` already mints the id; returning it through `MutationResult` and the tool result fixes both this and the app-side hook's need to identify the node it must stamp, at the cost of widening an IPC type the proposal route also uses.
- An `add-child` parent is unscoped today: the gate checks a target against the bound subtree only for `mark_step_complete`'s `node_id`. The criterion refusing an `add-child` outside the bound and granted subtrees is therefore a new refusal on the existing path rather than a consequence of the grant, and it narrows every both-mode step in the file. It needs its own criteria in the gate commit, not to ride in as part of the grant.
- A debrief step that resolves no applied context loses every finding silently: the gate refuses on `no-context` before it reaches the mode table, and an autonomous send is not suppressed for a context-less autonomous step. Same silent-loss class as the dangling destination in rule 11, and it wants the same treatment — either the grant is checked ahead of the no-context refusal, or the dialog refuses a debrief on a step with no context in scope.
- Weight 0 has no band and no criterion. A hand-typed finding, or one whose back-links were deleted, has no back-links at all; the bands start at 1.
- Idempotency keys on `linkedNodeId` equality with the subject node, so it holds only while the subject keeps its id. Accept-feedback rewrites the bound subtree and a decomposition promotes a different node; a debrief re-run after either adds a second back-link. The criterion covers re-sending against the same subject node only.
- Nothing ever marks a finding fixed. Weight only ascends and deletion is the only exit, so a papercut solved three stories ago keeps its red badge and keeps entering every later debrief prompt, where the session can attach further back-links to a solved problem. The register only stays informative if the user prunes it.
- `isFindingsRoot` is a flag rather than a reference, so it survives a copy the remapper does not touch: duplicating a Findings node yields a second badge-rendering root whose cloned back-links resolve differently on each side of the copy.
- A Findings node placed inside a bound subtree is destroyed by the step that rebuilds it. Findings survive `submit_step_output` only by living outside the bound subtree, and nothing stops the user pointing a debrief at a node inside a workflow subject. Same class of hazard as parking one under a context declaration.
- The badge branch must sit after the hyperlink branch and before both the blueprint and checkbox branches. `applyAddChild` inherits `isBlueprint` down a blueprint chain, so a Findings node parked in a blueprint subtree renders icons instead of weights if the branch lands in the wrong place.
- Findings are stored with `status: 'pending'` even though they render no checkbox, so a markdown export of a Findings subtree still writes checkboxes for them.

Out of scope beyond the list already given:

- Retiring, merging or reordering a finding from the session side, and any fixed state, decay or automatic pruning of the register.
- Retrofitting the archive section onto the new paste hook. The existing hook swallows a cross-file paste with no message and no `preventDefault`; extract or duplicate rather than reuse, or the archive flow inherits inline errors it was never specced for.

ROI:

- The cost is concentrated in two places nothing else in the feature needs: the second permission axis in the write gate and the created-id plumbing. Badge, register, dialog section and remapper entry are all small.
- The payoff cannot be verified until several stories have run — weight means nothing at n=1, and the register's usefulness depends on hand-pruning. Worth building, but the first few debrief steps should be read for filler before more workflows are pointed at it.

### Approach in brief

- The Findings node is an ordinary node. Findings are its children, a finding's children are its description and its back-links, and weight is a render-time count of back-links — recurrence is never persisted, so it cannot drift or double-count.
- The session's only write is `add_child_node`. The app owns everything the session cannot do: the back-link, which needs metadata, the collapse stamp, and the weight. The register is injected into the prompt by the send path because the session's read tools cannot see past the bound node.
- The review-sensitive change is one clause in the write gate: `debriefDestinationId` on the step authorises `add-child` into that subtree, keyed on kind and target together and checked alongside the mode table rather than inside it. Two things will surprise a reviewer — the mode table's "a submit-completing mode permits no direct-apply writes" invariant now holds by target rather than by kind, and the weight badge is a new status-area branch whose position among the existing five decides whether it renders at all.
