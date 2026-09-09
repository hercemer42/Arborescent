# In-tree markdown source editor

Depends on [003](003-story-file-links-and-preview.md).

## 📄 Product spec

### Context

Story 003 makes a story readable inside Arborescent, but only readable.
Spotting a typo or wanting to tighten a business rule while orchestrating means leaving the app, finding the file in an editor, changing it, saving, and coming back.

The user is the sole developer, and the edits in question are small and frequent — a reworded rule, a criterion that turned out to be untestable, a constraint discovered mid-implementation.
Small frequent edits are exactly the ones that get skipped when the round trip costs more than the change.

This story also builds the surface story 005 needs: a review of a proposed story revision has to render somewhere, and that somewhere is the same region.

### Goal

Let a file-link node expand in place to edit the file's markdown source, so small corrections happen where the story is being read.

### Business rules

1. A file-link node shows an expand caret even though it has no children, and expanding it reveals an editor holding the file's markdown source.
2. The expanded state persists on the node like any other, so a region left open reopens on reload.
3. The source is syntax-highlighted and editable; rendered reading stays with Preview from story 003.
4. Edits autosave on a two-second trailing debounce, matching the pattern the `.arbo` autosave already uses, on a timer of its own because the target is a different file.
5. There is no maximum-wait flush and no flush on quit, so continuous typing defers the write and edits made in the last seconds before a crash or quit are lost.
6. That exposure is accepted deliberately, amounting to a few minutes of small corrections in a pattern where quitting mid-keystroke is not realistic.
7. Before each write, the file's current state on disk is compared against what was read when the region opened, and the write is refused if it changed.
8. On refusal a warning appears once per opening of the region, naming the file and saying that autosave is blocked; it does not repeat on every subsequent debounce.
9. Refused edits stay in the region rather than being discarded, and the write is retried on blur, on an explicit save, on collapsing the region, and on closing the file.
10. Resolving a blocked write is an explicit two-way choice — overwrite the file, or discard the region's edits and reload from disk — and neither side is ever chosen silently.
11. Escape returns focus from the editor to its node, and the tree's own navigation keys are not swallowed while the editor holds focus.
12. Arborescent still neither creates, renames nor deletes story files; this story only writes to files a node already links.

### Acceptance criteria

#### Happy path

- [ ] A file-link node with no children shows an expand caret.
- [ ] Expanding it reveals the file's markdown source, syntax-highlighted and editable.
- [ ] Typing and then waiting writes the change to disk, and the file on disk matches the region.
- [ ] Collapsing and re-expanding the region shows the saved content.
- [ ] A region left expanded is still expanded after reopening the file.
- [ ] Escape moves focus from the editor to its node, and arrow keys then navigate the tree.

#### Edge cases

- [ ] Typing continuously for longer than the debounce writes nothing until typing pauses, and the file is correct once it does.
- [ ] A file changed on disk while the region is open blocks the write, warns once, and keeps the region's edits.
- [ ] The blocked-write warning does not repeat on subsequent debounces within the same opening of the region.
- [ ] Choosing overwrite writes the region's content and clears the blocked state.
- [ ] Choosing discard reloads from disk and loses the region's edits, with no write performed.
- [ ] A blocked write is retried on blur, on explicit save, on collapsing the region, and on closing the file.
- [ ] Deleting the file while the region is open blocks the write and reports the missing path rather than recreating it.
- [ ] Arrow keys, Enter and Escape inside the editor do not move the tree selection or create nodes.
- [ ] A node that is not a file link shows no caret when it has no children, exactly as today.

#### Non-functional

- [ ] A 500-line story opens in the region without visible delay.
- [ ] The editor adds no dependency beyond the editor component agreed for this story.

---

## 🔧 Implementation proposal

### Approach

The caret is a one-input change: `hasChildren` in `TreeNode.tsx` is the single value driving the gutter's caret and toggle, so it becomes `hasChildren || isFileLink`.
Persistence of the expanded state comes free from `metadata.expanded`.

The region below the node hosts an embedded source editor.
Reading uses the existing `readFile` channel with the traversal guard from story 003; writing needs a write channel with the same guard.

The save scheduler is a local copy of the `.arbo` autosave shape — a trailing timeout cleared and reset per keystroke — deliberately not the shared one, so the persistence path everything else depends on is untouched.
The disk-state comparison is taken when the region opens and refreshed after every successful write.

### Touchpoints

- **Tree node** — the caret condition, and the expanded region rendered beneath the node's own row.
- **Editor component** — a new dependency, configured for markdown only, with an explicit keymap and a focus-release binding.
- **Region component** — the editor host, the blocked-write banner, and the overwrite-or-reload choice.
- **Save scheduler** — a per-region trailing debounce plus the retry triggers.
- **Main process** — a guarded file write alongside the guarded read.
- **Tests** — the caret condition, debounce timing, the disk-state refusal and its once-per-open warning, both resolve paths, the retry triggers, and keymap containment.

### Constraints to call out

- This story cannot ship without an editor dependency, and the choice matters beyond bundle size: a full IDE component brings an entire keybinding and command surface into a keyboard-first app, where a modular editor lets the keymap be declared explicitly.
- Focus containment is the part most likely to need iteration. Inline node editing is precedent, but a source editor claims far more keys than a contenteditable node, and getting it wrong makes the feature feel broken for reasons unrelated to editing.
- This makes Arborescent a writer of files it does not own. The disk-state check protects against Arborescent clobbering an external edit, but nothing can stop an external editor with a stale buffer clobbering Arborescent's write — that is the irreducible cost of two writers.
- The save scheduler is deliberately separate from the shared `.arbo` autosave. That autosave has a pre-existing gap — no pending-write flush on quit — which this story does not fix and does not inherit.

### Out of scope

Rendered editing; multi-file search or replace; creating, renaming or deleting files; a maximum-wait flush; fixing the `.arbo` flush-on-quit gap; reviewing proposed changes (story 005).
