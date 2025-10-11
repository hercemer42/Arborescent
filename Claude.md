# Arborescent - Development Context

## Project Overview

**Arborescent** is a local-first development workflow tool. It organizes project tasks, architecture decisions, and implementation work in a hierarchical tree structure. The primary feature is exporting optimized context files that AI coding assistants can read, eliminating the need to re-explain your project on every prompt.

**Current Phase:** v0.1 MVP - Building the first brick
**Goal:** Working Electron app with tree UI and basic export functionality

## Architecture

### Tech Stack
- **Desktop:** Electron (local-first, file system access)
- **Frontend:** React 18 + TypeScript (strict mode)
- **Styling:** CSS (custom)
- **State:** Zustand (with organized actions pattern)
- **Build:** Vite + Electron Forge

### File Structure
```
arborescent/
├── src/
│   ├── main/              # Electron main process
│   │   └── services/      # IPC, menu, file operations
│   ├── renderer/          # React app
│   │   ├── components/
│   │   │   ├── Tree/
│   │   │   │   ├── Tree.tsx
│   │   │   │   └── useTreeListeners.ts   # Side-effect hook
│   │   │   ├── Node/
│   │   │   │   └── Node.tsx
│   │   │   ├── NodeContent/
│   │   │   │   ├── NodeContent.tsx
│   │   │   │   └── useNodeContent.ts     # Data hook
│   │   │   └── ui/              # Reusable UI components
│   │   ├── store/
│   │   │   ├── treeStore.ts     # Zustand store
│   │   │   └── actions/         # Business logic
│   │   │       ├── nodeActions.ts
│   │   │       ├── navigationActions.ts
│   │   │       └── fileActions.ts
│   │   ├── services/      # File I/O, hotkeys
│   │   └── data/          # Sample data, templates
│   └── shared/            # Shared types
├── templates/             # Built-in templates
└── examples/
```

### Data Model
```typescript
interface Node {
  id: string;
  type: 'project' | 'section' | 'task' | 'doc';
  content: string;
  children: string[];      // IDs of child nodes
  metadata: {
    status?: '☐' | '✓' | '✗';
    created?: string;
    updated?: string;
    [key: string]: any;
  };
}

interface Document {
  version: '1.0';
  rootNodeId: string;
  nodes: Record<string, Node>;  // Map of ID → Node
}
```

## Core Features (v0.1)

### Basic Tree UI
- [x] Recursive tree component (expand/collapse)
- [x] Display nodes with indentation
- [x] Click to select node
- [x] Basic styling

### CRUD Operations
- [ ] Add child node
- [x] Edit node content (inline editing)
- [ ] Delete node
- [ ] Cycle node type (Tab key: project → section → task → doc)
- [x] Cycle status (Tab on task: ☐ → ✓ → ✗)

### File Operations
- [x] Save tree to JSON file (Electron fs)
- [x] Load tree from JSON file
- [x] Application reload menu
- [ ] New project (clear tree, start fresh)
- [ ] Recent files list

### Export for AI
- [ ] Export current node + ancestors to markdown
- [ ] Save to `.arborescent/current.md`
- [ ] Context.json for project conventions
- [ ] Basic template system (load from JSON)

## Key Decisions

### Why Electron (not web app)?
- Local files (privacy, no server needed)
- File system access (read/write without upload)
- Works offline
- Native feel
- Can add web version later (reuse React components)

### Why custom tree (not react-arborist)?
- Need domain-specific behavior (status cycling, type cycling)
- Future flexibility (canvas view, timeline view)
- Better learning (understand tree algorithms)
- No library lock-in

### Why local-first?
- Privacy (user owns their data)
- No server costs for MVP
- Works offline
- Fast (no network latency)
- Can add sync later

### Why TypeScript?
- Catch bugs early (tree structures are complex)
- Better autocomplete
- Self-documenting
- Required for React best practices

## Implementation Notes

### Tree Rendering Approach
```tsx
// Recursive component pattern
function TreeNode({ nodeId, depth = 0 }: Props) {
  const node = nodes[nodeId];
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div style={{ paddingLeft: depth * 20 }}>
      <NodeHeader node={node} onToggle={() => setExpanded(!expanded)} />
      {expanded && node.children.map(childId => (
        <TreeNode key={childId} nodeId={childId} depth={depth + 1} />
      ))}
    </div>
  );
}
```

### State Management Strategy
- ✅ **Migrated to Zustand** (props drilling became painful)
- **Store Structure:** Organized with actions pattern (nodeActions, navigationActions, fileActions)
- **Business Logic Location:** Store actions (following Zustand best practices)
- **Hooks Purpose:** React-specific code only (effects, refs, event listeners)

### Hook Naming Conventions (Adopted 2025-10-11)

Following React best practices for custom hooks:

**All custom hooks must start with `use` prefix** (enforced by React)

**File Naming:** Hook files should be named after the hook function itself
- ✅ `useTreeListeners.ts` - contains `useTreeListeners()` hook
- ✅ `useNodeContent.ts` - contains `useNodeContent()` hook
- ❌ `Tree.hook.ts` - doesn't match React conventions

**Two types of hooks:**

1. **Data Hooks** - Return state/handlers (e.g., `useNodeContent`)
   - Return values for component to use
   - Example: `const { config, isEditing, handleClick } = useNodeContent(node)`

2. **Side-Effect Hooks** - Set up listeners/effects (e.g., `useTreeListeners`)
   - No return value (or returns cleanup only)
   - Name describes what they listen to/manage
   - Example: `useTreeListeners()` - sets up file menu + keyboard listeners

**Naming Pattern:** `use[PurposeOrBehavior]`
- ✅ `useTreeListeners` - sets up listeners for Tree
- ✅ `useNodeContent` - provides node content data/handlers
- ✅ `useKeyboardNavigation` - handles keyboard navigation
- ❌ `useTree` - too vague

### Export Format
```markdown
# Current Task

**Implement password reset flow**

## Context
File: `src/auth/reset.ts`
Feature: User Authentication
Status: ☐ Pending

## Parent Feature: Authentication System
- User registration ✓
- Login flow ✓
- Password reset ☐ (current)
- Email verification ☐

## Instructions
Generate reset token, store with expiry, send email.
Include error handling for invalid emails.

---
*Exported from arborescent*
*File: .arborescent/current.md*
```

## User Workflow (Target)

```
1. User opens Arborescent
2. Creates project structure:
   Project: My App
   ├─ Architecture
   │  └─ Use Hexagonal pattern
   └─ Features
      └─ Authentication
         ├─ User registration ✓
         └─ Password reset ☐

3. Right-click "Password reset" node
4. Select "Export for AI"
5. File created: .arborescent/current.md

6. In terminal/IDE:
   "@.arborescent/current.md implement this"

7. AI has full context, implements correctly

8. Mark task complete (Tab → ✓)
9. Move to next task
```

## Not in v0.1 (Future)

These are explicitly OUT OF SCOPE for MVP:
- ❌ Backend/API
- ❌ Template marketplace
- ❌ Share trees
- ❌ Multiple views (canvas, timeline)
- ❌ Search/filter
- ❌ Drag-and-drop reordering
- ❌ VSCode extension
- ❌ Cloud sync

**Focus:** Get basic tree + export working. Ship something usable.

## Success Criteria for v0.1

**Definition of done:**
- [ ] Can create/edit/delete nodes
- [x] Tree saves to local JSON file
- [x] Can load saved trees
- [ ] Export generates markdown with context
- [x] Works on Linux (primary development)
- [ ] Package as distributable
- [ ] Daily use test

**Goal: Ship something usable and iterate based on actual usage.**

## Development Principles

1. **Ship fast** - Working demo over perfect architecture
2. **YAGNI** - Don't build features until needed
3. **Use it yourself** - Dogfood early and often
4. **Iterate** - MVP doesn't need to be perfect
5. **Learn** - This is as much about skill-building as product
6. **Follow best practices** - But don't over-engineer

## Commands Reference

```bash
# Development
npm run dev              # Start Electron in dev mode

# Building
npm run build            # Build for production
npm run package          # Create .app bundle

# Testing
npm test                 # Run tests (add later)
```

## Next Steps

**Continue building core features:**
- Complete CRUD operations (add child, delete node)
- Add undo/redo
- Implement export functionality
- Improve keyboard shortcuts

**If it's useful:**
- Iterate based on actual usage
- Add more advanced features
- Consider sharing/collaboration features

**If it's not useful:**
- Pivot or learn from experience
- Portfolio piece regardless

---

*Last updated: 2025-10-11*
*When context gets stale, regenerate this file*

## Quick Start for AI

When implementing features for Arborescent:

1. **Check this file first** for architecture decisions and current state
2. **Follow TypeScript strict mode** (no implicit any)
3. **Keep components small** (single responsibility)
4. **Business logic goes in store actions** (not hooks or components)
5. **Hooks for React-specific code only** (effects, refs, event listeners)
6. **Test manually** (use the app as you build)

Current focus: **Completing CRUD operations and keyboard shortcuts**