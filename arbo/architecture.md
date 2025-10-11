# Architecture Design Decisions

This document records key architectural choices made during development sessions.

**Date:** 2025-10-11

## Directory Structure

**Decision:** Separate main process (Electron) code from renderer (React UI) code.

**Structure:**
```
src/
├── main/         # Electron main process (Node.js, file system, OS access)
│   └── services/ # IPC handlers, menu, file operations
├── preload/      # Security bridge between main and renderer
│   └── index.ts  # Context bridge API definitions
├── renderer/     # React application (browser sandbox)
│   ├── components/
│   ├── store/
│   ├── services/
│   └── data/
└── shared/       # Code used by both (types, interfaces)
    └── types/    # Organized type definitions
```

**Rationale:**
- Clear separation between Node.js/Electron code and browser/React code
- Easy to understand what runs where
- Security: renderer code runs in sandbox, main has system access
- Prevents accidental mixing of main and renderer APIs
- Preload directory allows for growth (multiple bridge files if needed)
- Follows Electron 2025 conventions for multi-process architecture

## Component Organization

**Decision:** Each component lives in its own subdirectory with co-located styles, hooks, and an index.ts barrel export.

**Structure:**
```
src/renderer/components/ComponentName/
├── index.ts              # Barrel export for clean imports
├── ComponentName.tsx     # Main component
├── ComponentName.css     # Component-specific styles
└── useComponentName.ts   # Custom hook (optional)
```

**Example:**
```typescript
// index.ts
export { ComponentName } from './ComponentName';
export { useComponentName } from './useComponentName';

// Usage in other files
import { ComponentName, useComponentName } from '../components/ComponentName';
```

**Rationale:**
- Components are self-contained and portable
- Styles and hooks stay with their component
- Easy to move or delete entire features
- Clear ownership of files
- Index files provide cleaner imports (no repetitive path segments)
- Hook files named after hook function (React 2025 convention)

## Style File Separation

**Decision:** Component styles live in separate `.css` files, imported by the component.

**Example:**
```css
/* ComponentName.css */
.component {
  display: flex;
  align-items: center;
  gap: 6px;
}
```

```typescript
// ComponentName.tsx
import './ComponentName.css';
```

**Rationale:**
- Separates concerns (logic vs presentation)
- Keeps component files focused on behavior
- Makes styles easy to find and modify
- Component-specific styles stay with component, not in global theme

## Node Type Configuration

**Decision:** Node types (icons) are user-definable data, not hardcoded in components.

**Implementation:**
```typescript
// In data
nodeTypeConfig: {
  project: { icon: '📁', style: '' },
  task: { icon: '', style: '' }
}

// In component
const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
```

**Rationale:**
- Users can define custom node types without code changes
- Makes the system more flexible
- Component logic doesn't need to know about specific types
- Style field reserved for future use

## Styling System

**Decision:** Use plain CSS with CSS custom properties, no preprocessors.

**Structure:**
- `src/renderer/globals.css` - CSS variables for colors and theme
- `src/renderer/styles.css` - Global resets and base styles
- Component `.css` files - Component-specific styles

**Rationale:**
- Modern CSS has variables, nesting support
- No build complexity or dependencies
- Full control over every style value
- Simpler and more direct than utility frameworks

## Comments

**Decision:** Only add comments when code is not self-explanatory.

**Rationale:**
- Code should be readable without comments
- Comments become stale and misleading
- Good naming and structure beats documentation
- Comments can be used when there is a high level of abstraction

## Type Organization

**Decision:** Split types into domain-specific files within a types directory, with a barrel export index.

**Structure:**
```
src/shared/types/
├── index.ts      # Re-exports all types
├── node.ts       # Node, NodeType, NodeStatus, NodeTypeConfig
├── document.ts   # Document, ArboFile
└── config.ts     # HotkeyConfig, other configuration types
```

**Example:**
```typescript
// node.ts
export type NodeType = string;
export type NodeStatus = '☐' | '✓' | '✗';
export interface Node { /* ... */ }

// index.ts
export type { NodeType, NodeStatus, Node } from './node';
export type { Document, ArboFile } from './document';
export type { HotkeyConfig } from './config';

// Usage
import { Node, NodeStatus, Document } from '../../../shared/types';
```

**Rationale:**
- Domain separation makes types easier to find
- Prevents single large types file (>200 lines gets unwieldy)
- Index file maintains backward compatibility with existing imports
- Related types grouped together logically
- Easier to add new domains without cluttering

## File Naming Conventions

**Decision:** Follow TypeScript/React 2025 best practices for file naming.

**Conventions:**
- **Components:** PascalCase matching component name
  - ✅ `Tree.tsx`, `Node.tsx`, `StatusCheckbox.tsx`
- **Hooks:** camelCase starting with "use"
  - ✅ `useTreeListeners.ts`, `useNodeContent.ts`
- **Services:** camelCase with "Service" suffix
  - ✅ `fileService.ts`, `hotkeyService.ts`
- **Store actions:** camelCase with "Actions" suffix
  - ✅ `nodeActions.ts`, `fileActions.ts`
- **Types:** camelCase or by domain
  - ✅ `node.ts`, `document.ts`, `config.ts`
- **Index files:** Always lowercase
  - ✅ `index.ts`

**Rationale:**
- Consistency across the codebase
- Matches 2025 React/TypeScript conventions
- File names match exported functions/classes
- Avoids case-sensitivity issues across operating systems
- Clear distinction between components (PascalCase) and utilities (camelCase)

## State Management Architecture

**Decision:** Use Zustand with organized actions pattern, keeping business logic in store actions.

**Structure:**
```
src/renderer/store/
├── treeStore.ts           # Main store with state + actions interface
└── actions/
    ├── nodeActions.ts      # Node CRUD operations
    ├── navigationActions.ts # Keyboard navigation
    └── fileActions.ts      # File I/O operations
```

**Pattern:**
```typescript
// Store defines state + actions interface
interface TreeState {
  nodes: Record<string, Node>;
  actions: NodeActions & NavigationActions & FileActions;
}

// Actions created in separate files
export const createNodeActions = (get, set): NodeActions => ({
  selectAndEdit: (nodeId) => { /* business logic */ },
  updateContent: (nodeId, content) => { /* business logic */ },
});

// Usage in components
const updateContent = useTreeStore((state) => state.actions.updateContent);
```

**Rationale:**
- Clear separation: State in store, business logic in actions, React code in hooks
- Actions are organized by domain (easier to find and maintain)
- Follows Zustand best practices: "Keep business logic in the store"
- Hooks remain focused on React-specific code (effects, refs, listeners)
- Services provide infrastructure layer (IPC, file I/O, keyboard matching)

**Architecture Layers:**
```
Components → Hooks (React) → Store Actions (Business Logic) → Services (Infrastructure)
```

**Update this file when making new architectural decisions.**
