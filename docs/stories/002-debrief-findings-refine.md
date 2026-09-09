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

- [ ] A debrief step fetches an existing finding's subtree by node id and receives its description.
- [ ] The step replaces a description line, and the finding renders the revised text with its weight incremented by one and a new back-link added.
- [ ] The step replaces a finding's title, and the finding renders the new title with its weight, back-links and subsequent register targeting all unaffected.
- [ ] A finding revised across three sessions carries three back-links and one title and description reflecting all three.

#### Edge cases

- [ ] Fetching a subtree by an id outside the bound subtree and the granted Findings subtree is refused.
- [ ] Replacing content at an id outside those two scopes is refused.
- [ ] Replacing a back-link's content is refused.
- [ ] Deleting a description line is refused, since the grant covers content replacement only.
- [ ] A step with no Findings node configured cannot fetch or replace any node by id.

#### Non-functional

- [ ] A debrief touching two findings fetches two subtrees, not the whole register.

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
