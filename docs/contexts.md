# Contexts

Contexts are reusable instructions for AI that you can apply anywhere in the tree. Each context has a **mode** — collaborate or execute — that determines what happens when you send a branch.

## Creating a Context

Write a branch containing the reusable instructions, then right-click → **Blueprint** → **Declare as Context**. Choose an icon and a mode:

- **Collaborate** — Sends content for AI review. The response appears in the Feedback panel for you to accept or reject.
- **Execute** — Sends content for immediate action. The AI produces output directly.

The branch must be a child of a blueprint branch, or be at the root level.

Example structure:
```
Code Review  ← declare as context (collaborate mode)
├── Check for security vulnerabilities
├── Verify error handling
└── Suggest performance improvements
```

Context declarations are marked with an asterisk overlay to the left of the node icon. This distinguishes them from regular blueprint branches at a glance.

When you send a branch, the applied context's instructions are included alongside your content, and the context's mode determines whether it collaborates or executes.

## Applying a Context

Right-click → **Apply context** to open the context picker. Contexts are grouped into **Collaborate** and **Execute** sections. Two built-in defaults are available at the top of each section:

- **Basic review (default)** — a simple collaborate context
- **Basic execution** — a simple execute context

Select a context to apply it. The applied context:

- Becomes the default for that branch and all its descendants
- Shows the context's icon in the gutter (left margin) at full opacity
- Persists until you apply a different one

Click an active context again to deselect it (returns to the default). When a context is inherited from an ancestor, the built-in defaults are hidden and the inherited context is shown with an "(inherited)" label.

Hover the gutter icon to see which context is applied and its mode.

## Visual Summary

- **Context declaration**: Asterisk overlay on the node icon in the content area. No gutter icon.
- **Applied context**: Context icon in the gutter. Hover for the context name and mode.
- **Context child** (descendant of a declaration): Inherited icon at reduced opacity in the content area.

If a context declaration also has an applied context from an ancestor, both indicators appear: the asterisk overlay on the node icon and the applied context icon in the gutter.

## Inheritance

Contexts flow down the tree. When you apply a context to a branch, all descendants inherit it.

A descendant can override by applying a different context. That override then applies to that branch and its descendants.

## Including Other Content

Context declarations can include hyperlinks to other branches. Right-click a branch → **Edit** → **Copy as Hyperlink**, then paste inside your context declaration.

When the context is sent to AI, hyperlinked content is resolved and included. This lets you reference shared definitions, specifications, or even other contexts, without duplicating them.
