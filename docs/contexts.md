# Contexts

Contexts are reusable instructions for AI that you can apply anywhere in the tree.

## Creating a Context

Write a branch containing the reusable instructions, then right-click → **Blueprint** → **Declare as Context**. Choose an icon to identify it.

The branch must be a child of a blueprint branch, or be at the root level.

Example structure:
```
Code Review  ← declare this as context
├── Check for security vulnerabilities
├── Verify error handling
└── Suggest performance improvements
```

Context declarations are marked with a Asterisk overlay to the left of the node icon. This distinguishes them from regular blueprint branches at a glance.

When you apply this context and execute a branch, the context instructions are sent alongside your branch content.

## Applying a Context

Three places to apply a context — they all work the same way:

- Right-click → **Execute** → apply context
- Right-click → **Collaborate** → apply context
- Right-click → **Apply context** → select from list

Applying a context in any of these menus updates all three. The applied context:

- Becomes the default for that branch and all its descendants
- Shows the context's icon in the gutter (left margin) at full opacity
- Persists until you apply a different one

Hover the gutter icon to see which context is applied.

## Visual Summary

- **Context declaration**: Asterisk overlay on the node icon in the content area. No gutter icon.
- **Applied context**: Context icon in the gutter. Hover for the context name.
- **Context child** (descendant of a declaration): Inherited icon at reduced opacity in the content area.

If a context declaration also has an applied context from an ancestor, both indicators appear: the Asterisk overlay on the node icon and the applied context icon in the gutter.

## Inheritance

Contexts flow down the tree. When you apply a context to a branch, all descendants inherit it.

A descendant can override by applying a different context. That override then applies to that branch and its descendants.

## Including Other Content

Context declarations can include hyperlinks to other branches. Right-click a branch → **Edit** → **Copy as Hyperlink**, then paste inside your context declaration.

When the context is sent to AI, hyperlinked content is resolved and included. This lets you reference shared definitions, specifications, or even other contexts, without duplicating them.
