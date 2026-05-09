# Changelog

## Unreleased

### Features

- **Run a branch as a terminal command**: A branch whose whole content is a single backticked snippet — `` `npm install` `` for a one-liner, or a triple-backtick block for multi-line — now runs in the terminal as a raw command with the wrapping backticks stripped, instead of being sent as markdown chrome (`# [ ]` heading and all). The branch must have no children and no applied context, and the gesture only fires on single-branch selections; multi-select, children, or an applied context all revert to the regular markdown send. Empty backticked branches send nothing.
- **Active terminal highlights its bound node**: When a terminal tab is active, the tree marks the node it's currently driving (a running workflow step or active terminal collaboration) with a thin blue stripe on the left edge. Switching tabs moves the stripe; selection is unaffected.
- **Feedback panel highlights changes**: When AI feedback opens in the panel, modified branches show with a blue background, added branches with green, and removed branches with a red background and strikethrough at the position they used to sit. Branches the AI returned untouched keep their original identity, so selection, expansion state, and internal hyperlinks to those branches survive across feedback rounds (and `.arbo` diffs in version control stay much smaller).
- **Four context states (Collaborate / Execute / Collaborate & Execute / Action)**: Contexts now have two independent toggles for whether the AI is asked to propose tree updates and whether it's asked to make code changes. The four resulting states surface as named items in the right-click context-mode submenu. Action — neither toggle on — sends the context body as a standalone instruction (no scaffolding, no branch content), useful when the context itself is the prompt. Existing `.arbo` files migrate on load: the previous Execute mode becomes Collaborate & Execute, preserving the long-standing "implement and check off" behaviour. Built-in **Basic execution** is now Collaborate & Execute; **Basic review** stays Collaborate.
- **Inline URLs in branches**: http(s), vscode://, and mailto: links inside any branch are now clickable while the branch isn't selected — they open in your default app. Pasting a URL no longer turns the branch into a link-only node, so URLs survive sends to AI and markdown export. Internal node-to-node hyperlinks (Copy as Hyperlink) are unchanged.
- **Workflow execution**: Declare blueprint branches as workflows with numbered steps, assign step types (Manual, Checkpoint, Autonomous) to control automation level, and run items through workflows with automatic advancement via AI tool hook integration. Supports nested workflows, parallel execution across terminal tabs, and configurable step timeouts
- **Keep computer awake during autonomous workflows**: While at least one autonomous workflow is running, the system is prevented from suspending so background AI work isn't interrupted. The block is released as soon as the last workflow finishes, errors, or is stopped. The display can still sleep — only system suspension is blocked.
- **Workflow disruption handling**: Running workflows stop gracefully when their terminal is closed, the item is moved or deleted, or the app restarts. Checkpoint items awaiting validation are preserved across restarts. Toast notifications explain what happened
- **Step configuration dialog**: Click a workflow step number to open a configuration dialog for that step, with step type selection, decomposition, recurse, and archive settings
- **Decomposition mode**: Enable decomposition on a workflow step to break a node into multiple sibling nodes from a single AI response. Useful for turning problem statements into user stories, specs into test cases, etc.
- **Archive with provenance**: Configure a workflow step to archive the original node before replacing it. The original is moved to a designated location with bidirectional hyperlinks connecting it to each replacement. Navigate the transformation chain by clicking the links. Fully undoable.
- **Recurse**: Pairs with decomposition. When an earlier step decomposes a node into siblings, enabling recurse on a later step automatically picks up each waiting sibling and runs it through the remaining steps one at a time. Recurse without decomposition is a no-op and surfaces a toast warning so you can fix the configuration. Includes a 50-iteration safety limit.
- **Clear AI session per step**: Enable Clear AI session on a workflow step so it runs against a fresh AI session — no context from prior turns. Useful for long chains or when you want a predictable starting state. Carries through blueprints. Requires a small update to the SessionStart hook (see docs/workflows.md Hook Setup).
- **Auto-accept for autonomous collaborate steps**: When an autonomous workflow step uses a collaborate-mode context, the AI's feedback is accepted automatically — the node content is replaced and the workflow advances without opening the feedback panel. Supports concurrent autonomous collaborations across multiple terminals. If feedback can't be parsed, the workflow pauses with an error instead of advancing with stale content.
- **Workflow context menu**: Workflow-related actions (Declare/Remove, Configure Step, Next/Previous step) are now in a dedicated "Workflow" submenu in the right-click menu. Start/Stop/Continue Workflow remain at the top level for quick access.
- **Simplified workflow state model**: Workflow execution uses a two-state model (running / awaiting-validation) instead of three states. Context menu shows Start, Stop, and Continue Workflow actions
- **Unified context modes**: Collaborate and Execute modes are now defined on context declarations instead of at send time, simplifying the send menu and making mode a property of the context itself
- **Simplified Send action**: Send is now a single menu item that routes to the active panel (terminal or browser). Hover to see the current mode and applied context name. Replaces the previous submenu with In terminal/In browser options
- **Apply context submenu grouping**: The Apply context submenu groups contexts into up to four sections by their state — Actions, Execute, Collaborate, and Execute & Collaborate. Sections without contexts are omitted. Built-in defaults sit inside the matching section: Basic execution under Execute, Basic review under Collaborate. Built-in defaults are hidden when a context is inherited. Submenu scrolls when content exceeds viewport height
- **Context indicator refactor**: Context declaration and applied context indicators consolidated with clearer visual hierarchy and tooltips
- **Desktop notifications and sounds**: OS desktop notifications and audio alerts for workflow completion, errors, NeedsReview, and timeouts. Configurable via File → Preferences toggles for desktop notifications and notification sounds (both on by default). Notifications are suppressed when the app is focused.
- **Execute mode feedback loop**: Terminal execute mode now uses the same round-trip pipeline as collaborate — the AI writes status updates to a temporary file, and the result appears in the Feedback panel for review (or auto-applies on autonomous workflow steps). Accept is undoable. The AI updates item statuses without rewriting your content.
- **Per-file panels**: Each open file now has its own panel state. Opening a terminal in one file and switching to another shows no panel — each file remembers which panel was open independently. Panel position and size remain global. Zoom tabs share their parent file's panel.
- **Per-file session persistence**: Panel visibility, browser tabs, and terminals are now saved per file and restored on restart. Terminals reopen in their original working directory (history is lost). Browser tabs remain scoped to the correct file.

### Bug fixes

- **Keyboard shortcuts now work reliably on first launch** — previously, shortcuts could fail intermittently on startup, requiring a reload (Ctrl+R) to fix
- **Tree-editing shortcuts no longer fire in terminal/browser panels** — cut, copy, paste, delete, select all, Escape, and view mode toggles are now properly gated when focus is in the terminal or browser
- **Pasting a hyperlink into a blueprint no longer marks the link as a blueprint itself** — a hyperlink is a reference to another node, so its blueprint status follows the link target, not where it's dropped
- **Copy as Hyperlink is now invalidated by any subsequent cut or copy** — previously a stale hyperlink could be pasted even after you copied other content over the clipboard, especially right after switching apps; pasting now reliably uses the most recent clipboard content
- **Right-click "Set context" submenu now reflects context renames immediately** — editing a context declaration's label updated the node but the submenu kept the old text until the next app restart. Undo/redo of the rename also stays in sync.
- **Switching back to a terminal tab now shows the latest output** — anchored terminals could appear stuck mid-buffer after a tab switch until you typed a key; they now snap to the bottom on reveal.
- **Copying a single leaf branch writes plain content to the clipboard** — previously copy and cut always wrote markdown chrome (`# [ ]` heading and status symbol) to the system clipboard, so pasting a single branch into Slack, email, a browser AI, or another branch's body required manually stripping the prefix. A leaf branch (no children) now copies its content as-is. Branches with children and multi-select selections still produce the markdown tree, so internal paste-back round-trips structure unchanged.

## 0.1.0 - Initial Release

First public release of Arborescent.

### Features

- Tree-based task decomposition with keyboard-first navigation
- Reusable contexts for AI instructions
- Execute and Collaborate workflows for terminal and browser AI tools
- Blueprint system for shareable workflow templates
- Integrated terminal and browser panels
- Summary mode for filtering by completion date
- Zoom mode for focusing on subtrees
- Drag and drop, multi-select, undo/redo
- YAML-based `.arbo` file format
