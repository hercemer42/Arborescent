# Contexts

Contexts are reusable instructions for AI. Define them once, apply them anywhere.

## Creating a Context

Write your AI instructions as a branch with children containing the details. Then right-click → **Blueprint** → **Declare as Context**. Choose an icon to identify it.

Note: The branch must be a child of a blueprint branch, or be at the root level.

Example structure:
```
Code Review  ← declare this as context
├── Check for security vulnerabilities
├── Verify error handling
└── Suggest performance improvements
```

The branch and all its children become the context content. When you select this context, everything underneath is sent to the AI.

## Selecting a Context

Three places to select a context—they all work the same way:

- Right-click → **Execute** → select context
- Right-click → **Collaborate** → select context
- Right-click → **Set context** → select context

Selecting a context in any of these menus updates all three. The selected context:

- Becomes the default for that branch and all its descendants
- Shows an icon in the gutter (left margin)
- Persists until you select a different one

## Inheritance

Contexts flow down the tree. When you select a context on a branch, all descendants inherit it.

A descendant can override by selecting a different context (through any of the three menus). That override then applies to that branch and its descendants.

In the menus, inherited contexts show "(default)" next to them.

## Including Other Content

Context declarations can include hyperlinks to other branches. Right-click a branch → **Edit** → **Copy as Hyperlink**, then paste inside your context declaration.

When the context is sent to AI, hyperlinked content is resolved and included. This lets you reference shared definitions, examples, other contexts, or specifications without duplicating them.
