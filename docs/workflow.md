# Core Workflow

## Break Down Your Project

Break down your project into branches. Press `Enter` to create siblings, `Tab` to indent, and `Shift+Tab` to outdent. Arrow keys navigate. `Ctrl+↑` and `Ctrl+↓` reorder branches.

Each branch has a status: unchecked, completed, or abandoned. Press `Ctrl+K` to cycle through them. Expand and collapse branches with `Ctrl+T`.

**Multi-select** with `Ctrl+Click` or `Shift+Click` (range), then drag to move, or cut/copy/delete.

## Apply Context

Before sending your prompt to an AI, you can apply a [context](contexts.md). Contexts are reusable instructions that tell the AI how to respond — they can be project conventions, coding style, review criteria, whatever you don't want to repeat.

Right-click any branch → **Apply context** to choose from the grouped context picker. The context applies to that branch and all its descendants.

## Log In to Your AI

Before sending prompts, open the Terminal panel (`` Ctrl+` ``) or Browser panel (`Ctrl+B`) and log into your preferred AI.

## Send Your Prompt

Right-click any branch → **Send**. The content is sent to whichever panel is currently active (terminal or browser). Hover the Send menu item to see the current state and applied context name.

The applied context's state determines what the AI is asked for. The four states are described in detail in [Contexts](contexts.md):

- **Collaborate** — Reviews and rewrites your content. Response goes to the Feedback panel.
- **Execute** — Makes code/file changes; reports back via the terminal.
- **Collaborate & Execute** — Both. AI makes the changes AND writes back the list with status markers. The default for the built-in **Basic execution** context.
- **Action** — The context body is the prompt; node content is omitted.

Collaborate and Collaborate & Execute use the same feedback pipeline — the AI's response appears in the Feedback panel for you to review, then Accept or Cancel (undoable with `Ctrl+Z`). Execute and Action don't open the panel.

The panel highlights what the AI changed: blue for modified branches, green for added ones, and red with strikethrough for branches the AI removed (shown where they used to sit). Editing a modified branch back to its original text in the panel clears its highlight. Branches the AI returned untouched keep their identity, so selection, expansion, and links to those branches survive feedback.

Two built-in contexts are available when no user-defined context is applied:

- **Basic review** — Collaborate. Reviews your content and suggests improvements. This is the default.
- **Basic execution** — Collaborate & Execute. Performs the task and writes back status markers.

Keyboard shortcuts: `Ctrl+E` (send in terminal), `Ctrl+Shift+E` (send in browser).

For the common "we discussed it in chat, fold the decisions back in" loop, right-click → **Revise after discussion** sends the branch with a one-shot revision prompt instead of the applied context. The branch's stored context is unchanged — it's a single send, not a state change.

### Run a Branch as a Command

A branch whose entire content is a single backticked snippet runs in the terminal as a raw command rather than as markdown. Wrap a one-liner with single backticks (`` `npm install` ``) or a multi-line script with triple backticks. The branch must have no children and no context applied — both signal review or editing intent — and only single-branch selections execute. Anything else falls back to the regular markdown send.

### How it works

**Terminal mode**: Instructions tell the AI to call the `submit_step_output` MCP tool with its response. Arborescent routes the submission to the Feedback panel for review, or applies it directly on autonomous workflow steps.

**Browser mode**: Instructions tell the AI to format its response as markdown in a code block. Copy the AI's response to your clipboard. Arborescent watches the clipboard and displays the result when it detects a compatible format.

## Refine

Each iteration improves your work:

1. Review what the AI produced
2. Update your branch or context based on what worked
3. Send again with the refined context

Your contexts compound over time. A context that started as "write clean code" evolves into detailed conventions specific to your project. Try running a review on a context itself to refine it!

If you have a context or other content you'd like to share, add it to a [blueprints](blueprints.md)

## View Modes

As your tree grows, use view modes to focus:

- **[Blueprint](blueprints.md) mode** (`Ctrl+Shift+B`): Shows only structural branches. [Blueprints](blueprints.md) let you mark branches as part of your workflow template — export them to share with others, or import community blueprints to jumpstart new projects.
- **Summary mode** (`Ctrl+Shift+U`): Shows only completed/abandoned branches within a date range
- **Zoom**: Right-click any branch → **Zoom** to focus on that subtree in a new tab

## Panels

Three panels support your workflow:

- **Terminal** (`` Ctrl+` ``): Integrated terminal for AI tools like Claude Code
- **Browser** (`Ctrl+B`): Built-in browser for web-based AI tools
- **Feedback** (`Ctrl+Shift+F`): Shows AI responses during Collaborate sessions

Each open file has its own panel state — open a terminal in one file, switch to another, and each remembers its own panel, browser tabs, and terminals independently. Zoom tabs share their parent file's panels.

Active sessions — collaborate, execute, and workflows — continue running when you switch files. When a session completes in a file you're not viewing, a notification tells you which file to check. Closing a file with an active session asks for confirmation before discarding it.

Panel state persists across restarts. When you reopen Arborescent, each file's panel visibility, browser tabs, and terminals are restored. Terminal history is lost (processes can't survive a restart), but terminals reopen in the same working directory.

Drag the panel edge to resize. Toggle between side and bottom position with the arrow button.

### Terminal tabs

Open a new terminal with `+` in the terminal tab bar. Switch between terminals by clicking their tabs — running processes and content are preserved when switching. Close a terminal with `×` on its tab. Closing a terminal whose AI prompt is still processing asks for confirmation first so an accidental click doesn't discard the in-flight response; idle terminals close immediately.

Sending or executing a branch into a terminal renames the tab to that branch's title (full title on hover). The tab keeps the title until the next branch is sent.

### Terminal scroll lock

Some terminal AI tools (like Claude Code) redraw the screen while processing, which can scroll you away from the output. Click the anchor icon in the terminal tab bar to pin the view to the bottom. Click it again to release.

Terminals start unanchored, so you can scroll back through output without unpinning first. Turn anchoring on when you want the view to follow streaming output through a redraw.
