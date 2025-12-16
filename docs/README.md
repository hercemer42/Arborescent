# Arborescent User Guide

Arborescent is a cognitive scaffolding tool for complex thinking and AI collaboration. This guide covers all features and workflows.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Basic Interactions](#basic-interactions)
- [Blueprints](#blueprints)
- [Contexts](#contexts)
- [Execute and Collaborate](#execute-and-collaborate)
- [Hyperlinks](#hyperlinks)
- [View Modes](#view-modes)
- [Panels](#panels)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Core Concepts

### Branches

Everything in Arborescent is a **branch**. Branches form a tree hierarchy where:
- Each branch can have children
- Children can be expanded or collapsed
- Branches have a status: pending, completed, or abandoned

### Status Indicators

Branches display a checkbox indicating their status:
- **☐ Pending** — Not yet started
- **✓ Completed** — Done
- **✗ Abandoned** — Intentionally skipped

Toggle status with `Ctrl+K` or click the checkbox.

### File Format

Arborescent uses `.arbo` files in YAML format, designed to be human-readable and version-control friendly.

---

## Basic Interactions

### Navigation

| Action | Shortcut |
|--------|----------|
| Move up/down | `↑` / `↓` |
| Move left/right | `←` / `→` |
| Expand/collapse | `Ctrl+T` |

### Creating Branches

| Action | Shortcut |
|--------|----------|
| New sibling below | `Enter`on a branch without descendents|
| New first child | `Enter` on a branch that has descendents |
| Split branch at cursor | `Ctrl + Enter` |

### Editing

| Action | Shortcut |
|--------|----------|
| Indent | `Tab` |
| Outdent | `Shift+Tab` |
| Move branch up | `Ctrl+↑` |
| Move branch down | `Ctrl+↓` |
| Delete branch | `Ctrl+D` |
| Delete line | `Ctrl+Backspace` |

### Clipboard Operations

| Action | Shortcut |
|--------|----------|
| Cut | `Ctrl+X` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Copy as hyperlink | Edit menu |
| Select all | `Ctrl+Shift+A` |

**Multi-selection**: Hold `Ctrl` and click to select multiple branches. Hold `Shift` and click to select a range. Cut/copy/delete operations work on all selected branches.

### Undo/Redo

| Action | Shortcut |
|--------|----------|
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |

Each file maintains its own undo history (up to 100 operations).

### Search

| Action | Shortcut |
|--------|----------|
| Open search | `Ctrl+F` |
| Next match | `Enter` or `F3` |
| Previous match | `Shift+Enter` or `Shift+F3` |
| Close search | `Escape` |

---

## Blueprints

Blueprints define the structure of your workflow. They persist across exports and can be shared as templates.

### Adding to Blueprint

Right-click a branch → **Blueprint** → **Add to Blueprint**

- Choose an icon and color for the branch
- The branch and all ancestors are automatically added to the blueprint

To add a branch with all its descendants: **Blueprint** → **Add with Descendants**

### Visual Indicators

Blueprint branches display a custom icon instead of the standard checkbox. Icons can be set per branch (click to change)

### Blueprint Mode

| Action | Shortcut |
|--------|----------|
| Toggle blueprint mode | `Ctrl+Shift+B` |

Blueprint mode filters the view to show only blueprint branches. This helps focus on structure without content distraction.

- New branches created in blueprint mode are automatically blueprints
- All editing operations work normally
- Exit via the same shortcut or View menu

### Export/Import

**Export as Blueprint** (File menu):
- Creates a new `.arbo` file containing only blueprint branches
- The exported file opens in blueprint mode by default

**Import from Blueprint** (File menu):
- Creates a new untitled document based on the blueprint structure
- Opens in normal mode

---

## Contexts

Contexts provide instructions to AI when you execute or collaborate. They're defined once and applied anywhere in your tree.

### Declaring a Context

Right-click a branch → **Blueprint** → **Declare as Context**

Requirements:
- The branch's parent must be a blueprint
- Choose an icon to identify the context

Context declaration:
- Makes the branch and all descendants part of the blueprint
- The context is sent to AI when applied to a branch and used to execute or collaborate

### Applying a Context

Right-click a blueprint branch → **Set context** or directly in **Execute** or **Colaborate**

- Select from available contexts
- The applied context's icon appears in the gutter
- Descendants inherit the applied context

### Context Inheritance

Applied contexts flow down the tree:
1. When you apply a context to a branch, all descendants inherit it
2. A descendant can override with its own explicit context
3. The closest ancestor's context wins

### Hyperlinks in Contexts

Context declarations can include hyperlinks to other branches. When the context is sent to AI:
- Hyperlinked content is resolved and included

---

## Execute and Collaborate

Both actions send branch content (with context) to an AI. The difference is what happens after.

### Execute

Right-click → **Execute** → **In Terminal** or **In Browser**

| Action | Shortcut |
|--------|----------|
| Execute with context | `Ctrl+E` |

Execute sends content to the AI for immediate action:
- **In Terminal**: Opens terminal panel, sends content, executes automatically
- **In Browser**: Copies to clipboard, opens browser panel.  The user then opens their AI tool and pastes the content manually.  This is for tools like Claude Code on the web.

### Collaborate

Right-click → **Collaborate** → **In Terminal** or **In Browser**

| Action | Shortcut |
|--------|----------|
| Collaborate with context | `Ctrl+Shift+Enter` |

Collaborate initiates a feedback loop:
1. Content is sent to AI with instructions to review/update
2. AI response appears in the Feedback panel
3. You can edit the response
4. Accept to replace your original branch, or Cancel
5. Repeat the process to further refine your thinking

How it works :

In terminal mode, built in instructions tell the AI to write the reply to a temporary file. Arborescent watches this file, and when it changes, displays the results in the feedback panel.

In browser mode, built in instructions tell the AI to give the reply in markdown format in a code block. The user pastes into the AI and copies the result. Arborescent watches for changes to the clipboard, and when it detects the appropriate format, it displays the results in the feedback panel.

### Context Selection

Both Execute and Collaborate menus show available contexts:
- Select one to use for this action
- Selection persists per branch (execute and collaborate have separate selections)
- Descendants inherit their ancestor's selection

### Blueprint Hyperlink Resolution

When executing a blueprint branch that contains hyperlinks:
- Hyperlink content is resolved and included
- This enables "action" branches that reference other content

---

## Hyperlinks

Hyperlinks reference other branches in the same file.

### Creating Hyperlinks

1. Right-click a branch → **Edit** → **Copy as Hyperlink**
2. Navigate to destination
3. Paste (`Ctrl+V`)

### Behavior

- **Click**: Navigate to the linked branch in a new tab in Arborescent's browser panel
- **Ctrl+Click**: Navigate to the linked branch in your default browser
- **Edit**: Content is read-only (reflects source at creation time)
- **Delete**: Hyperlinks can be deleted normally
- **Copy**: Creates a new hyperlink to the same target

### Hyperlinks in Blueprints

Hyperlinks inherit blueprint status from their parent. In context declarations, hyperlinked content is resolved when the context is used.

### Cross-File Links

Hyperlinks only work within the same file. Pasting a hyperlink into a different document has no effect.

---

## View Modes

### Normal Mode

The default view showing all branches.

### Blueprint Mode

Shows only blueprint branches. Toggle with `Ctrl+Shift+B`.

### Summary Mode

Shows only branches resolved (completed/abandoned) within a date range.

| Action | Shortcut |
|--------|----------|
| Toggle summary mode | `Ctrl+Shift+U` |

When active:
- Date picker appears at top of workspace
- Tab shows clipboard icon with green background
- Filter defaults to last 7 days

### Zoom Mode

Focus on a specific branch and its descendants.

Right-click a branch → **Zoom**

- Opens in a new tab showing only that subtree
- Changes sync with the main file (same underlying data)
- Closing the zoom tab returns to the main view
- Zoom tabs persist across sessions

---

## Panels

### Terminal

| Action | Shortcut |
|--------|----------|
| Toggle terminal | `` Ctrl+` `` |

Features:
- Multiple terminal tabs (+ button to create)
- Pin/unpin auto-scroll (anchor icon)
- Resize by dragging the panel edge

### Browser

| Action | Shortcut |
|--------|----------|
| Toggle browser | `Ctrl+B` |

Features:
- Multiple browser tabs
- Back, forward, reload navigation
- Address bar (non-URL input searches Ecosia)
- Links open in panel by default, Shift+click for system browser

### Feedback Panel

| Action | Shortcut |
|--------|----------|
| Toggle feedback | `Ctrl+Shift+F` |

Shows during active collaboration. Displays AI response in editable tree format.

### Panel Position

Toggle button moves panel between right side and bottom. Position and size persist across sessions.

---

## Keyboard Shortcuts

### File Operations

| Action | Shortcut |
|--------|----------|
| New file | `Ctrl+N` |
| Open file | `Ctrl+O` |
| Save | `Ctrl+S` |
| Save as | `Ctrl+Shift+S` |
| Close tab | `Ctrl+W` |

### Navigation

| Action | Shortcut |
|--------|----------|
| Move up/down | `↑` / `↓` |
| Move left/right | `←` / `→` |
| Expand/collapse | `Ctrl+T` |
| Search | `Ctrl+F` |

### Editing

| Action | Shortcut |
|--------|----------|
| New sibling | `Enter` |
| New child | `Ctrl+Enter` |
| Indent | `Tab` |
| Outdent | `Shift+Tab` |
| Move branch up | `Ctrl+↑` |
| Move branch down | `Ctrl+↓` |
| Toggle status | `Ctrl+K` |
| Delete branch | `Ctrl+D` |

### Clipboard

| Action | Shortcut |
|--------|----------|
| Cut | `Ctrl+X` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Select all branches | `Ctrl+Shift+A` |

### Actions

| Action | Shortcut |
|--------|----------|
| Execute | `Ctrl+E` |
| Collaborate | `Ctrl+Shift+Enter` |

### View

| Action | Shortcut |
|--------|----------|
| Toggle terminal | `` Ctrl+` `` |
| Toggle browser | `Ctrl+B` |
| Toggle feedback | `Ctrl+Shift+F` |
| Blueprint mode | `Ctrl+Shift+B` |
| Summary mode | `Ctrl+Shift+U` |

---

## Tips

### Spellcheck

Arborescent includes spellcheck using your system language. Right-click misspelled words for suggestions.

### External Links

Paste a URL to create an external link branch. Click to open in your default browser.

### Soft Delete

Deleted branches are soft-deleted (hidden but recoverable). Buffer holds 10 deletions—exceeding this permanently removes the oldest. Undo (`Ctrl+Z`) restores deleted branches.

### Drag and Drop

Drag branches to reorganize. Drop into collapsed branches expands them. Hold `Ctrl` while dropping to copy instead of move.

### Tab Management

- Hover over tab to see full file path
- Close tabs with `Ctrl+W` or the × button
- Zoom tabs show magnifying glass icon
