# Contexts

Contexts are reusable instructions for AI. Define them once, apply them anywhere.

## Creating a Context

Write your AI instructions as a branch with children containing the details. Then right-click → **Blueprint** → **Declare as Context**. Choose an icon to identify it.

Example structure:
```
Code Review  ← declare this as context
├── Check for security vulnerabilities
├── Verify error handling
└── Suggest performance improvements
```

The branch and all its children become the context content. When you apply this context, everything underneath is sent to the AI.

## Applying a Context

Right-click any branch → **Execute** or **Collaborate** → select your context from the list.

The context persists for that branch. Next time you execute or collaborate from it, the same context is pre-selected.

## Inheritance

Contexts flow down the tree. When you apply a context to a branch, all descendants inherit it.

A descendant can override with its own context selection. The closest ancestor's context wins.

In the Execute/Collaborate menus, inherited contexts show "(default)" next to them.

## Including Other Content

Context declarations can include [hyperlinks](workflow.md) to other branches. Right-click a branch → **Edit** → **Copy as Hyperlink**, then paste inside your context declaration.

When the context is sent to AI, hyperlinked content is resolved and included. This lets you reference shared definitions, examples, other contexts, or specifications without duplicating them.

## Applying a Default Context

For branches that always use the same context, apply it as a default. Right-click a [blueprint](blueprints.md) branch → **Blueprint** → **Apply Context**.

The applied context becomes the default for Execute and Collaborate on that branch and its descendants. You can still override per-action if needed.

Applied contexts show an icon in the gutter (left margin).
