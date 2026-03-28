# Changelog

## Unreleased

### Features

- **Workflow execution**: Declare blueprint branches as workflows with numbered steps, assign step types (Manual, Checkpoint, Autonomous) to control automation level, and run items through workflows with automatic advancement via AI tool hook integration. Supports nested workflows, parallel execution across terminal tabs, and configurable step timeouts
- **Workflow disruption handling**: Running workflows stop gracefully when their terminal is closed, the item is moved or deleted, or the app restarts. Checkpoint items awaiting validation are preserved across restarts. Toast notifications explain what happened
- **Step configuration dialog**: Click a workflow step number to open a configuration dialog for that step, with step type selection, decomposition, recurse, and archive settings
- **Decomposition mode**: Enable decomposition on a workflow step to break a node into multiple sibling nodes from a single AI response. Useful for turning problem statements into user stories, specs into test cases, etc.
- **Archive with provenance**: Configure a workflow step to archive the original node before replacing it. The original is moved to a designated location with bidirectional hyperlinks connecting it to each replacement. Navigate the transformation chain by clicking the links. Fully undoable.
- **Recurse**: Enable sequential processing of multiple items through an automated workflow chain. When a step produces several outputs (e.g. via decomposition), recurse automatically picks up each waiting item and runs it through the remaining steps one at a time. Includes a 50-iteration safety limit.
- **Auto-accept for autonomous collaborate steps**: When an autonomous workflow step uses a collaborate-mode context, the AI's feedback is accepted automatically — the node content is replaced and the workflow advances without opening the feedback panel. Supports concurrent autonomous collaborations across multiple terminals. If feedback can't be parsed, the workflow pauses with an error instead of advancing with stale content.
- **Workflow context menu**: Workflow-related actions (Declare/Remove, Configure Step, Next/Previous step) are now in a dedicated "Workflow" submenu in the right-click menu. Start/Stop/Continue Workflow remain at the top level for quick access.
- **Simplified workflow state model**: Workflow execution uses a two-state model (running / awaiting-validation) instead of three states. Context menu shows Start, Stop, and Continue Workflow actions
- **Unified context modes**: Collaborate and Execute modes are now defined on context declarations instead of at send time, simplifying the send menu and making mode a property of the context itself
- **Simplified Send action**: Send is now a single menu item that routes to the active panel (terminal or browser). Hover to see the current mode and applied context name. Replaces the previous submenu with In terminal/In browser options
- **Apply context submenu grouping**: The Apply context submenu now groups contexts into Collaborate and Execute sections with built-in defaults (Basic review, Basic execution). Built-in defaults are hidden when a context is inherited. Submenu scrolls when content exceeds viewport height
- **Context indicator refactor**: Context declaration and applied context indicators consolidated with clearer visual hierarchy and tooltips
- **Desktop notifications and sounds**: OS desktop notifications and audio alerts for workflow completion, errors, NeedsReview, and timeouts. Configurable via File → Preferences toggles for desktop notifications and notification sounds (both on by default). Notifications are suppressed when the app is focused.
- **Execute mode feedback loop**: Terminal execute mode now uses the same round-trip pipeline as collaborate — the AI writes status updates to a temporary file, and the result appears in the Feedback panel for review (or auto-applies on autonomous workflow steps). Accept is undoable. The AI updates item statuses without rewriting your content.
- **Per-file panels**: Each open file now has its own panel state. Opening a terminal in one file and switching to another shows no panel — each file remembers which panel was open independently. Panel position and size remain global. Zoom tabs share their parent file's panel.
- **Per-file session persistence**: Panel visibility, browser tabs, and terminals are now saved per file and restored on restart. Terminals reopen in their original working directory (history is lost). Browser tabs remain scoped to the correct file.

### Bug fixes

- **Keyboard shortcuts now work reliably on first launch** — previously, shortcuts could fail intermittently on startup, requiring a reload (Ctrl+R) to fix
- **Tree-editing shortcuts no longer fire in terminal/browser panels** — cut, copy, paste, delete, select all, Escape, and view mode toggles are now properly gated when focus is in the terminal or browser

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
