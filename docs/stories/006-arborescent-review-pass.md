# An Arborescent review pass with mandated retrieval

## 📄 Product spec

### Context

Code review in this project currently means the built-in `code-review` skill run against a diff.
It reads the code well and knows nothing else: not what the change was supposed to do, not which conventions apply to the part of the tree it touches, not which of its findings rest on a real rule.

The user is the sole developer, reviewing their own work with an AI as the only second opinion.

The Forest Admin Validator solves the same problem for a different codebase by mandating retrieval before judgement — the ticket's acceptance criteria, the documented behaviour, and the conventions scoped to each touched area — and by verifying findings before reporting them.
That skill is installed at user scope on this machine and therefore visible from Arborescent sessions, but it encodes Forest's Linear workspace, Mintlify docs site and repo registry, so running it here produces findings anchored to rules that do not exist in this project.

Without an equivalent, two failure modes recur: a review that misses a change failing its own acceptance criteria because it never read them, and a review that reports a confident finding citing a convention this project does not hold.

### Goal

Give Arborescent a review pass that retrieves the spec and the applicable conventions before judging, and drops any finding it cannot anchor to one of them.

### Business rules

1. The review is invoked as a project skill against a diff, a branch or a pull request, in the same shape as the built-in `code-review` skill.
2. Before judging anything, the review retrieves the acceptance criteria of the story or bug file for the work under review.
3. If it cannot identify a spec file for the change, it says so and reviews on conventions alone rather than inventing intent.
4. Conventions are resolved per touched area from a checked-in source, so a review runs without Arborescent itself running.
5. Areas are the process boundaries — `main`, `preload`, `renderer`, `shared` — because the IPC trust seam and the store-per-file model make a renderer rule wrong in main and the reverse.
6. Every finding cites the acceptance criterion or convention it rests on, by file and section.
7. A finding that cannot cite either is dropped rather than reported with a lower severity.
8. Findings are verified before reporting: a second pass attempts to refute each one, and anything refuted is dropped.
9. Findings are reported through the structured findings contract so they render in the host UI rather than as prose.
10. The review never edits code; applying fixes is a separate explicit step.
11. The review must not invoke the Forest validator or ecosystem-review skills, which encode another organisation's internals and are only visible here because that plugin is installed at user scope.

### Acceptance criteria

#### Happy path

- [ ] Invoking the skill on a branch retrieves the linked spec file and reports which acceptance criteria the diff satisfies and which it does not.
- [ ] A finding about renderer code cites a renderer convention, and a finding about a main-process handler cites a main-process one.
- [ ] Every reported finding names the file and section of the rule it rests on.
- [ ] A finding the verification pass refutes does not appear in the report.
- [ ] Findings render as structured items in the host UI, not as prose.

#### Edge cases

- [ ] A diff with no identifiable spec file produces a conventions-only review that states the spec was not found.
- [ ] A diff touching two areas resolves both convention sets and does not apply one area's rules to the other's files.
- [ ] A diff touching only tests still reports against the testing conventions.
- [ ] An acceptance criterion already satisfied by pre-existing code is reported as satisfied rather than as missing work.
- [ ] The review makes no edit to the working tree, even when a fix is obvious.
- [ ] Invoking the review in a session where the Forest skills are visible does not call them.

#### Non-functional

- [ ] The review runs without Arborescent open, so it works in CI and in a bare checkout.

---

## 🔧 Implementation proposal

### Approach

Implement the procedure directly as a project skill at `.claude/skills/review/`.
The retrieval-then-verify shape is the valuable part and it transfers as prose, so there is nothing to share with another project's implementation and no dependency worth taking on.

The conventions source is `CLAUDE.md` at the repo root, which a review can read without Arborescent running.
The richer corpus in the `Conventions` subtree of `project.arbo` is not reachable by a review process and should not be made a prerequisite; extracting it to `docs/conventions/`, one file per area, is a later improvement that the skill already defers to where it exists.

### Touchpoints

- **`docs/conventions/`** — one file per process area, extracted from the `Conventions` subtree.
- **Project skill** — the review procedure, its retrieval steps and its verification pass.
- **Spec lookup** — resolve the story or bug file for a change from the branch name or the work item's file link.
- **Findings reporting** — the structured findings contract rather than printed prose.

### Constraints to call out

- The area rules the skill needs are stated in the skill itself, because `CLAUDE.md` does not carry the IPC trust-seam or one-store-per-file rules that a generic reviewer gets wrong. That duplicates them, so when `docs/conventions/` is extracted it becomes canonical and the skill's copies go.
- Arborescent has a real trust seam — the renderer is user-facing JavaScript and the main process validates its input — so a security lens over `src/main/handlers` is part of the review rather than an optional extra.
- The Forest skills stay visible in Arborescent sessions as long as that plugin is installed at user scope, so rule 11 has to be stated in the skill rather than assumed from context.

### Rejected alternatives

- **Using the Forest Validator directly.** It anchors findings to a Linear workspace, a Mintlify site and a repo registry that do not exist here, so its citations would be fabricated rather than merely absent.
- **Consuming a shared, Forest-agnostic extraction of it.** Raised as PRD-1017 and cancelled: with one consumer on each side the split is plumbing landed ahead of its consumer, and the procedure transfers as prose for far less.
- **Extending the built-in `code-review` skill's prompt in place.** The retrieval and verification steps are the substance, and they need to be mandated rather than suggested; a longer prompt to a general skill does not make a step mandatory.

### Out of scope

Multi-repository review; an ADR corpus; ticket-tracker integration; applying fixes; replacing the built-in `code-review` skill for quick passes where retrieval is not worth the cost.
