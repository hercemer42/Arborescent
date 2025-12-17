# Contexts

Contexts are reusable instructions for AI. Define them once, apply them anywhere.

## Creating a Context

Contexts should be generic and reusable. Your regular branches contain specific content for a particular task.

To create a context: write a branch containing the reusable instructions. Then right-click → **Blueprint** → **Declare as Context**. Choose an icon to identify it.

Note: The branch must be a child of a blueprint branch, or be at the root level.

Example structure:
```
Code Review  ← declare this as context
├── Check for security vulnerabilities
├── Verify error handling
└── Suggest performance improvements
```

When you apply this context and execute a branch, the context instructions are sent alongside your branch content.

## Applying a Context

Three places to apply a context—they all work the same way:

- Right-click → **Execute** → apply context
- Right-click → **Collaborate** → apply context
- Right-click → **Apply context** → select from list

Applying a context in any of these menus updates all three. The applied context:

- Becomes the default for that branch and all its descendants
- Shows an icon in the gutter (left margin)
- Persists until you apply a different one

## Inheritance

Contexts flow down the tree. When you apply a context to a branch, all descendants inherit it.

A descendant can override by applying a different context. That override then applies to that branch and its descendants.

## Including Other Content

Context declarations can include hyperlinks to other branches. Right-click a branch → **Edit** → **Copy as Hyperlink**, then paste inside your context declaration.

When the context is sent to AI, hyperlinked content is resolved and included. This lets you reference shared definitions, examples, other contexts, or specifications without duplicating them.
