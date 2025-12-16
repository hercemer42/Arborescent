# Core Workflow

The main loop: **decompose → add context → send to AI → refine**.

## Decompose Your Thinking

Break down problems into branches. Press `Enter` to create siblings, `Tab` to create children. Arrow keys navigate. `Ctrl+↑` and `Ctrl+↓` reorder branches.

Each branch is a checkbox you can mark complete (`Ctrl+K`) or abandon (click twice). The tree structure lets you think non-linearly — jump between branches, collapse what you're not working on, expand when you need detail.

## Add Context

Before sending work to an AI, you can attach a [context](contexts.md). Contexts are reusable instructions that tell the AI how to respond — your project conventions, coding style, review criteria.

Right-click any branch → **Execute** or **Collaborate** → select a context from the list. The context applies to that branch and all its descendants.

## Send to AI

Two ways to send your work:

**Execute** sends content for immediate action. Use this when you want the AI to do something — generate code, answer a question, run a command.

- **In Terminal**: Content goes directly to your terminal AI (like Claude Code).
- **In Browser**: Content is copied to clipboard. Paste it into your browser-based AI.

**Collaborate** initiates a feedback loop. Use this when you want to refine your thinking with AI assistance.

- Content is sent with instructions for the AI to review and suggest changes
- The AI response appears in the Feedback panel (right side)
- Edit the response if needed
- Accept to replace your original branch, or Cancel to keep it

Keyboard shortcuts: `Ctrl+E` for Execute, `Ctrl+Shift+Enter` for Collaborate.

## Refine

Each iteration improves your work:

1. Review what the AI produced, keep or modify only what works for you.
2. Update your branch or context based on what worked
3. Send again with the refined context

Your contexts compound over time. A context that started as "write clean code" evolves into detailed conventions specific to your project.
See what happens when you run a review on a context itself !

## View Modes

As your tree grows, use view modes to focus:

- **Blueprint mode** (`Ctrl+Shift+B`): Shows only structural branches (your workflow template)
- **Summary mode** (`Ctrl+Shift+U`): Shows only completed/abandoned branches within a date range
- **Zoom**: Right-click any branch → **Zoom** to focus on that subtree in a new tab

## Panels

Three panels support your workflow:

- **Terminal** (`` Ctrl+` ``): Integrated terminal for AI tools like Claude Code
- **Browser** (`Ctrl+B`): Built-in browser for web-based AI tools
- **Feedback** (`Ctrl+Shift+F`): Shows AI responses during Collaborate sessions

Drag the panel edge to resize. Toggle between side and bottom position with the arrow button.
