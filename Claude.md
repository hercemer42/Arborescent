# Arborescent - Development Context

## Project Overview

**Arborescent** is a local-first development workflow tool. It organizes project tasks, architecture decisions, and implementation work in a hierarchical tree structure. The primary feature is exporting optimized context files that AI coding assistants can read, eliminating the need to re-explain your project on every prompt.

**Current Phase:** v0.1 MVP - Building the first brick
**Goal:** Working Electron app with tree UI and basic export functionality

## Tech Stack

- **Desktop:** Electron (local-first, file system access)
- **Frontend:** React 18 + TypeScript (strict mode)
- **Styling:** CSS (custom)
- **State:** Zustand (organized actions pattern)
- **Build:** Vite + Electron Forge

## Architecture

### High-Level Structure
```
src/
├── main/         # Electron main process (Node.js, file system, IPC)
├── preload/      # Security bridge (context bridge)
├── renderer/     # React app (components, store, services)
│   ├── components/    # Each has: Component.tsx, .css, hooks, index.ts
│   ├── store/         # Zustand with organized actions/
│   ├── services/      # Infrastructure (file I/O, hotkeys)
│   └── data/          # Sample data, templates
└── shared/       # Shared types (organized by domain)
```

**📋 See `arbo/architecture.md` for detailed conventions and decisions.**

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

## Feature Progress (v0.1)

### ✅ Completed
- [x] Recursive tree component (expand/collapse)
- [x] Click to select node
- [x] Inline editing
- [x] Save/load tree to JSON file
- [x] Application reload menu
- [x] Keyboard navigation (arrow keys)
- [x] Status cycling for tasks (☐ → ✓ → ✗)

### 🚧 In Progress / Todo
- [ ] Add child node
- [ ] Delete node
- [ ] Cycle node type (Tab key: project → section → task → doc)
- [ ] New project (clear tree, start fresh)
- [ ] Export current node + ancestors to markdown
- [ ] Save to `.arborescent/current.md`
- [ ] Undo/redo functionality

### 🔮 Future (Out of Scope for MVP)
- Template marketplace
- Multiple views (canvas, timeline)
- Search/filter
- Drag-and-drop reordering
- Cloud sync
- VSCode extension

## Key Decisions

### Why Electron?
- Local files (privacy, no server needed)
- File system access without upload
- Works offline
- Can add web version later (reuse React components)

### Why Custom Tree?
- Need domain-specific behavior (status cycling, type cycling)
- Better learning (understand tree algorithms)
- No library lock-in

### Why Zustand?
- Props drilling became painful
- Lighter than Redux
- Actions pattern keeps business logic organized

## Target User Workflow

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

## Commands

```bash
npm run dev      # Start Electron in dev mode
npm run build    # Build for production
npm run package  # Create distributable
npm run lint     # Check TypeScript/ESLint
```

## Success Criteria

**MVP is done when:**
- [ ] Can create/edit/delete nodes
- [x] Tree saves to local JSON file
- [x] Can load saved trees
- [ ] Export generates markdown with context
- [x] Works on Linux
- [ ] Package as distributable
- [ ] Use it daily for one week

**Goal:** Ship something usable and iterate based on actual usage.

## Development Principles

1. **Ship fast** - Working demo over perfect architecture
2. **YAGNI** - Don't build features until needed
3. **Use it yourself** - Dogfood early and often
4. **Iterate** - MVP doesn't need to be perfect

---

## Quick Start for AI

When implementing features for Arborescent:

1. **Check this file** for current state and feature progress
2. **Read `arbo/architecture.md`** for detailed architectural decisions and conventions
3. **Follow TypeScript strict mode** (no implicit any)
4. **Business logic in store actions** (not hooks or components)
5. **Hooks for React-specific code** (effects, refs, listeners)
6. **Use barrel exports** - import from directory: `from './components/Tree'`
7. **Test manually** as you build

**Architecture Layers:**
```
Components → Hooks (React) → Store Actions (Logic) → Services (Infrastructure)
```

**Current focus:** Completing CRUD operations and keyboard shortcuts

*Last updated: 2025-10-11*
