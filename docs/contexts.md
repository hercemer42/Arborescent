# Contexts

Contexts are reusable instructions for AI that you can apply anywhere in the tree. Each context has a **state** that determines what happens when you send a branch — whether the AI proposes tree updates, makes code changes, both, or simply follows the context as a standalone instruction.

## The Four States

- **Collaborate** — The AI reviews your content and writes back tree updates as one revised list. The proposed revision appears inline on the branch you sent, for you to accept or reject.
- **Execute** — The AI makes code or file changes in the codebase and reports back via the terminal. No tree updates expected.
- **Collaborate & Execute** — Both. The AI makes the changes and checks items off in the tree as it completes them — `[x]` for done, `[-]` for failed — recording each issue it hits as its own child item. You watch progress land item by item instead of receiving one rewritten list at the end. This is the state of the built-in **Basic execution** context.
- **Action** — The AI follows the context body as a standalone instruction. Nothing else is added to the prompt — no scaffolding, not even the branch's content. Useful when the context itself IS the prompt.

The state also decides which tree edits the AI may make during a run. Collaborate puts everything in the single written-back list; Collaborate & Execute permits additions and check-offs but never rewrites, deletions, or moves; Execute and Action permit no tree edits at all. An AI that reaches for the wrong channel gets a refusal naming the right one, so a misconfigured step fails loudly instead of silently rewriting your tree.

## Creating a Context

Write a branch containing the reusable instructions, then right-click → **Blueprint** → **Declare as Context**. The branch must be a child of a blueprint branch (or at the root). Choose an icon.

To set or change the state, right-click the context branch → **Blueprint** → **Context mode**, then pick one of the four states.

Example:
```
Code Review  ← declared as context, Collaborate state
├── Check for security vulnerabilities
├── Verify error handling
└── Suggest performance improvements
```

Context declarations are marked with an asterisk overlay to the left of the node icon.

## Applying a Context

Right-click any branch → **Apply context** to open the picker. Contexts are grouped into up to four sections matching their state: **Actions**, **Execute**, **Collaborate**, and **Execute & Collaborate**. Sections without contexts are omitted, so the picker only shows what's relevant.

Built-in defaults sit inside the section that matches their state:
- **Basic review** appears under **Collaborate**
- **Basic execution** appears under **Execute**

Built-in defaults are hidden when a context is inherited from an ancestor.

The applied context:
- Becomes the default for that branch and all its descendants
- Shows its icon in the gutter (left margin) at full opacity
- Persists until you apply a different one

Click an active context again to deselect it. When inherited, the context shows with "(inherited)" appended.

Hover the gutter icon to see the context name and state.

Click the gutter icon to jump to the context's declaration. The tree selects and scrolls to the branch where the context is defined — expanding any collapsed ancestors on the way — even when the declaration sits far up the tree or is inherited from an ancestor. Built-in contexts (Basic review, Basic execution) have no declaration branch, so their icons aren't clickable.

## Inheritance

Contexts flow down the tree. When you apply a context to a branch, all descendants inherit it. A descendant can override by applying a different context — that override then applies to it and its descendants.

## Including Other Content

Context declarations can include hyperlinks to other branches. Right-click a branch → **Edit** → **Copy as Hyperlink**, then paste inside your context declaration. When the context is sent to AI, hyperlinked content is resolved and included. This lets you reference shared definitions, specifications, or other contexts without duplicating them.
