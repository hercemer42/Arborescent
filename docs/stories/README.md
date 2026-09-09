# Stories

One markdown file per user story.
Prose lives here; workflow state lives in Arborescent.

## Naming

`NNN-short-slug.md` — zero-padded sequence, never renumbered.
The number is the story's stable handle in commits, branch names and PR titles.

## Format

Two sections separated by `---`:

- `## 📄 Product spec` — context, goal, business rules (numbered, one complete sentence each), acceptance criteria (`- [ ]`, each independently testable, grouped into happy path / edge cases / non-functional).
- `## 🔧 Implementation proposal` — approach, touchpoints, constraints a reviewer would not guess. High level only; the diff and the review cover the detail.

## Line breaks

One sentence per line in prose, and no reflowed paragraphs or mid-sentence hard wraps.
List items and numbered rules stay on one line each, since they are already the atomic unit a diff points at.
Markdown renders this identically, and every diff — in a PR, in the tree, anywhere — then points at the sentence that changed rather than at a repainted block.
Retrofitting it once there are twenty stories is not cheap, so it applies from the first.

## What does not go in a story file

Status, assignee, step position, session bindings.
A story file is the specification, not the work item — the work item is the Arborescent node that points at this file, and that node owns the orchestration state.
Keeping state out of the file means a story can be edited on a branch and reviewed in a PR without touching anything a running workflow depends on.
