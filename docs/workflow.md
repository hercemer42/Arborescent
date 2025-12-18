# Core Workflow

## Break Down Your Project

Break down your project into branches. Press `Enter` to create siblings, `Tab` to indent, and `Shift+Tab` to outdent. Arrow keys navigate. `Ctrl+↑` and `Ctrl+↓` reorder branches.

Each branch has a status: unchecked, completed, or abandoned. Press `Ctrl+K` to cycle through them. Expand and collapse branches with `Ctrl+T`.

**Multi-select** with `Ctrl+Click` or `Shift+Click` (range), then drag to move, or cut/copy/delete.

## Apply Context

Before sending your prompt to an AI, you can apply a [context](contexts.md). Contexts are reusable instructions that tell the AI how to respond — they can be project conventions, coding style, review criteria, whatever you don't want to repeat.

Right-click any branch → **Execute** or **Collaborate** → apply a context from the list. The context applies to that branch and all its descendants.

## Log In to Your AI

Before sending prompts, open the Terminal panel (`` Ctrl+` ``) or Browser panel (`Ctrl+B`) and log into your preferred AI.

## Send Your Prompt

Two ways to send your work:

**Execute** sends content for immediate action. Use this when you want the AI to do something—like generate code or answer a question.

- **In Terminal**: Content goes directly to your terminal AI.
- **In Browser**: Content is copied to clipboard. Paste it into your browser-based AI.

**Collaborate** initiates a feedback loop. Use this when you want to refine your thinking with AI assistance.

- Content is sent with instructions for the AI to review and suggest changes.
- The AI response appears in the Feedback panel (right side).
- Edit the response if needed.
- Accept to replace your original branch, or Cancel to keep it.
- There is a default context provided to review a list and suggest improvements. You can replace this with your own custom context, for instance critique a list, reduce it, translate it etc.

Keyboard shortcuts: `Ctrl+E` for Execute (in terminal), `Ctrl+Shift+Enter` for Collaborate (in terminal).  (Be sure to log in to your AI first)

### How it works

**Terminal mode**: Instructions tell the AI to write its response to a temporary file. Arborescent watches this file and displays the result in the Feedback panel when it changes.

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

Drag the panel edge to resize. Toggle between side and bottom position with the arrow button.

### Terminal scroll lock

Some terminal AI tools (like Claude Code) redraw the screen while processing, which can scroll you away from the output. Click the anchor icon in the terminal tab bar to fix the view to the bottom of the terminal. Click it again to turn it off.
