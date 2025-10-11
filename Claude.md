# Arborescent - Development Context

## Project Overview

**Arborescent** is a local-first development workflow tool. It organizes project tasks, architecture decisions, and implementation work in a hierarchical tree structure. The primary feature is exporting optimized context files that AI coding assistants can read, eliminating the need to re-explain your project on every prompt.

**Current Phase:** v0.1 MVP - Building the first brick
**Timeline:** 4 weeks
**Goal:** Working Electron app with tree UI and basic export functionality

## Architecture

### Tech Stack
- **Desktop:** Electron (local-first, file system access)
- **Frontend:** React 18 + TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **State:** Start with useState, migrate to Zustand if needed (Week 3+)
- **Build:** Vite + Electron Forge

### File Structure
```
arborescent/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/          # React app
│   │   ├── components/
│   │   │   ├── Tree.tsx
│   │   │   ├── TreeNode.tsx
│   │   │   └── NodeHeader.tsx
│   │   ├── types.ts
│   │   └── App.tsx
│   └── shared/            # Shared types
├── templates/             # Built-in templates
│   └── basic.json
└── examples/
    └── example-project.json
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

### Week 1: Basic Tree UI
- [ ] Recursive tree component (expand/collapse)
- [ ] Display nodes with indentation
- [ ] Click to select node
- [ ] Basic styling with Tailwind

### Week 2: CRUD Operations
- [ ] Add child node (right-click menu)
- [ ] Edit node content (inline editing)
- [ ] Delete node (with confirmation)
- [ ] Cycle node type (Tab key: project → section → task → doc)
- [ ] Cycle status (Tab on task: ☐ → ✓ → ✗)

### Week 3: File Operations
- [ ] Save tree to JSON file (Electron fs)
- [ ] Load tree from JSON file
- [ ] New project (clear tree, start fresh)
- [ ] Recent files list

### Week 4: Export for AI
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
- **Week 1-2:** useState for nodes map
- **Week 3+:** Migrate to Zustand if props drilling becomes painful
- **With Zustand:** Use persist middleware for auto-save

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

These are explicitly OUT OF SCOPE for first brick:
- ❌ Backend/API (Week 5+)
- ❌ Template marketplace (Month 2)
- ❌ Share trees (Month 2)
- ❌ Multiple views (canvas, timeline)
- ❌ Undo/redo
- ❌ Search/filter
- ❌ Keyboard shortcuts (beyond Tab)
- ❌ Drag-and-drop reordering
- ❌ VSCode extension
- ❌ Cloud sync

**Focus:** Get basic tree + export working. Ship something usable.

## Success Criteria for v0.1

**Definition of done:**
- ✅ Can create/edit/delete nodes
- ✅ Tree saves to local JSON file
- ✅ Can load saved trees
- ✅ Export generates markdown with context
- ✅ Works on macOS (primary target)
- ✅ Package as .app (Electron Builder)
- ✅ I use it daily for one week

**If I use it for one week and it helps → success.**

## Development Principles

1. **Ship fast** - Working demo over perfect architecture
2. **YAGNI** - Don't build features until needed
3. **Use it yourself** - Dogfood from Week 2
4. **Iterate** - v0.1 doesn't need to be perfect
5. **Learn** - This is as much about skill-building as product

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

## Next Steps After v0.1

**If it's useful:**
- Add keyboard shortcuts
- Add undo/redo
- Improve export formats
- Start backend (template marketplace)

**If it's not useful:**
- Pivot or abandon
- Portfolio piece regardless
- Learning experience

---

*Last updated: 2025-10-11*
*When context gets stale, regenerate this file*

## Quick Start for AI

When implementing features for Arborescent:

1. **Check this file first** for architecture decisions
2. **Check arbo/ directory** for design decisions and session notes
3. **Save major design decisions to arbo/architecture.md** for major design decisions
4. **Follow TypeScript strict mode** (no implicit any)
5. **Use Tailwind for styling** (utility classes only)
6. **Keep components small** (single responsibility)
7. **Test manually** (use the app as you build)

Current focus: **Building the tree UI with basic CRUD operations**