# A debrief refines an existing finding

Depends on [001](001-debrief-findings-write-path.md).

## 📄 Product spec

### Context

Story 001 makes findings accumulate weight and evidence, but a finding's title and description are written once, by whichever session happened to observe the problem first.
A first sighting rarely names a problem well: the session that hits it once describes a symptom, and the session that hits it for the fourth time is the one that can name the cause.

The user is the sole developer, reading the Findings node to decide what to fix next.
What they need from a finding is its best current articulation, not the first guess.

Without this, the register is a set of frozen first impressions with rising numbers next to them — the weight improves with evidence but the wording never does, so the entry that recurs most is often the one worst described.

### Goal

Let a debrief step read and revise an existing finding, so its articulation improves with each recurrence instead of freezing at its first sighting.

### Business rules

1. The read tool that returns a subtree gains an optional node id, accepted only for the bound node or a node inside the step's granted Findings subtree, so a session can pull a finding's full description on demand.
2. The content-replacement write tool gains an optional node id under the same scope rule, so a session can revise wording in place.
3. Both additions are gated by the story 001 capability grant and are refused for any node outside the bound subtree and the granted Findings subtree.
4. The grant permits replacing a finding's title as well as its description, because every reference in the system is by uuid and renaming therefore breaks nothing; improving the headline is part of the synthesis.
5. The grant refuses content replacement on a hyperlink node, so the evidence a synthesis rests on cannot be rewritten by the synthesis; this is a single check on the target, not a rule about the subtree's shape.
6. The register still carries titles and weights only, so prompt cost scales with the findings a session actually touches rather than with the size of the register.
7. Revising a finding still attaches a back-link for the revising session, because a revision is itself a recurrence report.

### Acceptance criteria

#### Happy path

- [x] A debrief step fetches an existing finding's subtree by node id and receives its description.
- [x] The step replaces a description line, and the finding renders the revised text with its weight incremented by one and a new back-link added.
- [x] The step replaces a finding's title, and the finding renders the new title with its weight, back-links and subsequent register targeting all unaffected.
- [x] A finding revised across three sessions carries three back-links and one title and description reflecting all three.

#### Edge cases

- [x] Fetching a subtree by an id outside the bound subtree and the granted Findings subtree is refused.
- [x] Replacing content at an id outside those two scopes is refused.
- [x] Replacing a back-link's content is refused.
- [x] Deleting a description line is refused, since the grant covers content replacement only.
- [x] A step with no Findings node configured cannot fetch or replace any node by id.

#### Non-functional

- [x] A debrief touching two findings fetches two subtrees, not the whole register.

---

## 🔧 Implementation proposal

### Approach

Add an optional node id to the existing subtree-read tool and to the existing content-replacement write tool rather than introducing two new tools, so the model has fewer tools to reason about and both share one scope check.
That check is the story 001 grant resolver reused verbatim — bound subtree, or the declared Findings subtree — with the hyperlink-target refusal as its only additional predicate.

### Touchpoints

- **MCP read tools** — optional node id on the subtree read, routed through the shared scope check instead of the bound-node-only resolver.
- **MCP write tools** — optional node id on content replacement, gated by kind and target through the same check.
- **MCP server tool descriptions** — both parameters documented as Findings-scoped, so the model does not attempt them elsewhere.
- **Tests** — scope acceptance and refusal for both tools, title revision succeeding, back-link content refusal.

### Constraints to call out

- This is the first read tool in the app that accepts a node id. Until now every read has been bound-node-only, and that invariant is load-bearing in how sessions are reasoned about.
- Allowing title revision means the register a session was given can name a finding differently from how it ends the session. Nothing breaks, because targeting is by uuid, but two sessions reading the same register concurrently could each rename the same finding and the last write wins.
- The synthesis model carries a hazard this story creates: wording revised across sessions with no retained evidence would be unfalsifiable, and drift toward a plausible generic complaint would be undetectable. The back-links are the mitigation, which is why rule 5 exists.

### Why this is a separate story

Story 001 is a working loop on its own — findings accumulate, weights and back-links are real, wording is written at creation.
This story is where the surface widens: the first node-id-accepting read tool and the first out-of-subtree content write.
Separating them means the loop can be validated in real use before edit capability is granted, and the permission change is reviewed on its own.

### Out of scope

Deleting or moving findings from a session; merging two findings; editing back-links.

### Complications

Risks not covered by the acceptance criteria:

- `set_node_content` has no direct-apply route in any mode today: `directApplyMutationKinds` is empty for collaborate, execute and action, and `both` carries additive kinds only. Every revision therefore lands through the grant's mode-policy bypass, which until now turned on a single kind. The tool's registered description — "Only allowed in collaborate-only mode on automatic steps" — is already false and has to be rewritten alongside the new parameter.
- The node-id target check in the mutation path is shared with `mark_step_complete`. Widening it in place hands `mark_step_complete` the Findings subtree and breaks story 001's rule that no other kind inherits the grant; the widened scope must key on the request kind.
- The grant resolver lives in the write-tools module, which imports the read-tools module. Reusing it verbatim on the read side closes an import cycle unless it is extracted to a shared module first.
- Rule 1's scope reads two ways: the bound node, or the bound subtree. The existing gate helper is subtree-wide, and subtree-wide is what makes the read parameter useful for resolving ids on ordinary steps; the edge criterion for a step with no Findings node currently reads as bound-node-only. One of the two has to give.
- Replacing content with an empty string deletes a description line in effect, which the criteria refuse only by withholding a delete capability. A non-empty check is the whole distance between "revision only" and deletion.
- The Findings root is inside its own granted subtree, so the grant as scoped permits rewriting the register root itself. That write also produces no evidence: the hook derives the touched finding as the root's child on the path and finds none, so it lands with rule 7 silently unsatisfied.
- Reads are not gated by route. The write half is autonomous-only because a proposal cannot land, but nothing stops a node-id read on a manual or checkpoint step whose `debriefDestinationId` survived a step-type change.
- An id that resolves to nothing currently serialises to `null` and returns success, so a mistyped id reads back as an empty finding. The id-accepting read needs its own refusal.
- Fetching a finding returns its back-links as children: a weight-12 finding costs twelve hyperlink nodes of JSON to read one description line. `depth` is the only lever and it cannot separate description children from evidence children.
- The evidence hook is add-child-shaped — parent id plus created id, with "new finding" keyed on the parent being the root. A revision has neither, so it must pass its target as the path anchor and skip the new-finding branch, or a revised title is re-split into a title and a description child.

Out of scope beyond the list already given:

- Any read of the register other than one named finding: no search, no whole-register fetch, no cross-file read.
- Metadata revision. `expanded`, `isFindingsRoot` and `linkedNodeId` stay app-owned, and `set_node_metadata` gains nothing here.
- Repair of a finding damaged by a bad revision. There is no revision history; undo is the user's, in the app.

ROI:

- A small diff on a sensitive surface: two gate clauses, one resolver extraction, one call into the existing evidence hook. The cost is reviewing the permission surface, not writing the code.
- The payoff is unverifiable until the same finding has been revised by two or three sessions — story 001's n=1 problem again, and this is the story that can make a finding worse, because a revision replaces the wording the earlier back-links were attached to.
- Nothing in story 001's loop depends on this. If revision produces drift, both parameters can be withdrawn without touching anything 001 shipped.

### Approach in brief

- Both additions are one optional node id on a tool that already exists, resolved through a single shared predicate — bound subtree or granted Findings subtree, refused on a hyperlink target — lifted out of the write-tools module so the read side can use it. No new tool, and no permission axis beyond the one the grant already opened.
- The read change is a gate change only. The read state already carries every node in the file; bound-node-only was enforced by which id got serialised, not by what was fetched, so nothing new crosses the IPC boundary.
- Two things will surprise a reviewer: `set_node_content` has no direct-apply route in any mode today, so this story is its first anywhere in the app and it arrives through the grant's bypass rather than the mode table; and the widened target check must key on the request kind, or `mark_step_complete` inherits Findings scope that story 001 explicitly forbids it.
