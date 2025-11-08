# Architecture Design Decisions

This document records key architectural choices made during development sessions.

**Last Updated:** 2025-11-08

**When updating this file:** Be concise - focus on the decision, pattern, and rationale. Avoid verbose explanations.

## Directory Structure

**Decision:** Separate main process (Electron) code from renderer (React UI) code, with plugins isolated outside core.

**Structure:**
```
src/
├── main/         # Electron main process (Node.js, file system, OS access)
│   └── services/ # IPC handlers, menu, file operations
├── preload/      # Security bridge between main and renderer
│   └── index.ts  # Context bridge API definitions
├── platforms/    # Platform-specific service implementations
│   └── electron/ # Electron implementations (storage, menu, error)
├── renderer/     # React application (browser sandbox)
│   ├── components/
│   ├── store/
│   ├── services/ # Infrastructure layer (DOM, IPC, browser APIs)
│   ├── plugins/  # Plugin system core (registry, context, interfaces)
│   ├── utils/    # Pure functions for renderer (position, ancestry)
│   └── data/
└── shared/       # Code used by both main and renderer
    ├── types/    # Type definitions (TreeNode, ArboFile, Plugin interfaces, etc.)
    ├── services/ # Shared services (logger)
    └── utils/    # Pure functions shared across platforms (fileNaming)

plugins/          # Plugins directory (outside src/ to emphasize separation)
├── core/         # Plugin system core
│   ├── interface.ts          # Re-exports from src/shared/types/plugins.ts
│   ├── renderer/
│   │   ├── Registry.ts       # Plugin lifecycle management
│   │   ├── Provider.tsx      # React context provider
│   │   └── initializePlugins.ts  # Built-in plugin initialization
│   ├── main/     # Plugin IPC handler registry
│   ├── worker/   # Plugin worker thread
│   └── preload/  # Plugin preload API registry
└── claude-code/  # Claude Code integration plugin
    ├── main/     # IPC handlers for Claude CLI interaction
    └── renderer/ # React components and plugin implementation
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

## Co-location vs Centralization

**Decision:** Co-locate single-component concerns, centralize multi-component shared state.

**Principle:**
- **Co-locate** when code is used by **one component only**
  - Component-specific CSS files
  - Component-specific hooks
  - Component-specific utilities
- **Centralize** when code is **shared across multiple components**
  - State stores (used by multiple components)
  - Shared services (infrastructure layer)
  - Shared utilities (pure functions used everywhere)

**Examples:**

**Co-located (Component-specific):**
```
src/renderer/components/NodeContent/
├── NodeContent.tsx          # Only NodeContent uses these files
├── NodeContent.css          # Styles for NodeContent only
└── hooks/
    ├── useNodeContent.ts    # Only NodeContent uses this hook
    ├── useNodeEditing.ts    # Only NodeContent uses this hook
    └── useNodeCursor.ts     # Only NodeContent uses this hook
```

**Centralized (Multi-component shared):**
```
src/renderer/store/
├── files/
│   └── filesStore.ts        # Used by: TabBar, Workspace, App
├── toast/
│   └── toastStore.ts        # Used by: App, useAppErrorHandling, logger
└── tree/
    └── treeStore.ts         # Used by: Tree, TreeNode, NodeContent
```

**How to decide:**
1. **Is it used by multiple components?** → Centralize in `store/`, `services/`, or `utils/`
2. **Is it only used by one component?** → Co-locate in component folder
3. **Not sure yet?** → Start co-located, move to centralized when second consumer appears

**Rationale:**
- Co-location makes single-component code easy to find and modify
- Centralization makes shared dependencies explicit and discoverable
- Prevents confusion: centralized location signals "this is shared"
- Matches the mental model: component folder = component-specific, store folder = shared state
- Easy to refactor: move from co-located to centralized when usage expands

## Hook Composition

**Decision:** Complex hooks should be split into focused hooks with single responsibilities, then composed.

**Pattern:**
```typescript
// Specialized hooks
useNodeEditing()      // Content editing, DOM syncing
useNodeCursor()       // Cursor position management
useNodeKeyboard()     // Keyboard event handling
useNodeContextMenu()  // Context menu state

// Main hook composes them
export function useNodeContent(node: TreeNode) {
  const { contentRef, handleInput } = useNodeEditing(node);
  const { setCursorPosition, setRememberedVisualX } = useNodeCursor(node, contentRef);
  const { contextMenu, handleContextMenu } = useNodeContextMenu(node);
  const { handleKeyDown } = useNodeKeyboard({ /* ... */ });

  return { contentRef, handleInput, handleKeyDown, contextMenu, handleContextMenu };
}
```

**Rationale:**
- Single Responsibility Principle for hooks
- Easier to test individual concerns in isolation
- Specialized hooks remain co-located with their component

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

**Decision:** Only add comments when code is not self-explanatory or when refactoring would add unnecessary complexity.

**Rationale:**
- Code should be readable without comments
- Comments become stale and misleading
- Good naming and structure beats documentation
- Comments are acceptable when:
  - There is a high level of abstraction
  - The code handles complex edge cases or performance optimizations
  - Refactoring to eliminate the need for comments would make the code harder to understand
  - Explaining "why" something is done a certain way (not "what" it does)

## Type Organization

**Decision:** Split types into domain-specific files within a types directory, with a barrel export index.

**Structure:**
```
src/shared/types/
├── index.ts      # Re-exports all types
├── treeNode.ts   # TreeNode, NodeStatus
├── document.ts   # Document, ArboFile
└── plugins.ts    # Plugin interfaces (Plugin, PluginManifest, etc.)
```

**Example:**
```typescript
// treeNode.ts
export type NodeStatus = '☐' | '✓' | '✗';
export interface TreeNode { /* ... */ }

// index.ts
export type { NodeStatus, TreeNode } from './treeNode';
export type { Document, ArboFile } from './document';
export type { Plugin, PluginManifest } from './plugins';

// Usage
import { TreeNode, NodeStatus, Document } from '../../../shared/types';
```

**Rationale:**
- Domain separation makes types easier to find
- Prevents single large types file (>200 lines gets unwieldy)
- Index file maintains backward compatibility with existing imports
- Related types grouped together logically
- Easier to add new domains without cluttering

## File Naming Conventions

**Decision:** Hybrid convention - React convention for components, TypeScript convention for classes and functions.

**Conventions:**
- **React Components:** PascalCase matching component name
  - ✅ `Tree.tsx`, `Node.tsx`, `StatusCheckbox.tsx`
- **Classes:** PascalCase matching class name
  - ✅ `PluginManager.ts`, `PluginRegistry.ts`, `PluginContext.ts`
  - ✅ `services/Storage.ts`, `services/Menu.ts` (directory provides "Service" context)
- **Functions/Utilities:** camelCase describing functionality
  - ✅ `useTreeListeners.ts` (hooks start with "use")
  - ✅ `nodeActions.ts`, `fileActions.ts` (action creators)
  - ✅ `initializePlugins.ts` (initialization functions)
  - ✅ `loadHandlers.ts` (utility functions)
- **Types:** camelCase by domain
  - ✅ `node.ts`, `document.ts`, `config.ts`
- **Index files:** Always lowercase
  - ✅ `index.ts`

**General Rules:**
- Don't repeat directory names in file names
  - ✅ `plugins/core/PluginManager.ts` (not `plugins/core/PluginCoreManager.ts`)
  - ✅ `platforms/electron/services/Storage.ts` (not `platforms/electron/ElectronStorageService.ts`)
  - ✅ `renderer/services/cursor.ts` (not `renderer/services/cursorService.ts`)
- Directory structure provides context, file names should be concise
- When directory name already describes the file type (services/, components/, actions/), omit that suffix from file name

**Rationale:**
- Hybrid approach appropriate for Electron (front-end + Node.js)
- React convention (PascalCase components) for renderer process
- TypeScript convention (PascalCase classes, camelCase functions) for main/worker processes
- File names match exported symbols (class `Storage` in `services/Storage.ts`)
- Clear distinction: Components and Classes use PascalCase, functions use camelCase
- Avoids applying front-end conventions to Node.js code
- Eliminates redundancy: directory context makes prefixes unnecessary

## State Management Architecture

**Decision:** Use Zustand with organized actions pattern, keeping business logic in store actions.

**Structure:**
```
src/renderer/store/
├── files/
│   ├── filesStore.ts                # Multi-file management (tabs, workspace)
│   └── actions/
│       └── fileActions.ts           # File orchestration (open/close/save dialogs)
└── tree/
    ├── treeStore.ts                 # Tree state + actions interface
    └── actions/
        ├── nodeActions.ts           # Node CRUD operations
        ├── navigationActions.ts     # Keyboard navigation
        ├── persistenceActions.ts    # Document I/O (load/save/autosave)
        ├── nodeMovementActions.ts   # Movement operations (indent/outdent/up/down)
        └── nodeDeletionActions.ts   # Soft-delete operations
```

**Pattern:**
```typescript
// Store defines state + actions interface
interface TreeState {
  nodes: Record<string, Node>;
  actions: NodeActions & NavigationActions & PersistenceActions & TreeStructureActions;
}

// Actions created in separate files
export const createNodeActions = (get, set): NodeActions => ({
  selectAndEdit: (nodeId) => { /* business logic */ },
  updateContent: (nodeId, content) => { /* business logic */ },
});

// Usage in components (via context)
const updateContent = useStore((state) => state.actions.updateContent);
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

## Focused Actions Pattern

**Decision:** Split large action files into focused modules by activity, compose them directly in the store.

**Pattern:**
```
actions/
├── nodeMovementActions.ts       # Movement operations
└── nodeDeletionActions.ts       # Deletion operations
```

**Example:**
```typescript
// nodeMovementActions.ts - Focused module
export interface NodeMovementActions {
  indentNode: (nodeId: string) => void;
  outdentNode: (nodeId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
}

export const createNodeMovementActions = (get, set): NodeMovementActions => {
  // Internal helpers as private functions
  function reparentNode(...) { }
  function swapSiblings(...) { }

  // Public interface
  return { indentNode, outdentNode, moveNodeUp, moveNodeDown };
};

// treeStore.ts - Composition in store
export const createTreeStore = () => create<TreeState>((set, get) => ({
  // ... state
  actions: {
    ...createNodeActions(get, set),
    ...createNodeMovementActions(get, set),
    ...createNodeDeletionActions(get, set),
  }
}));
```

**Pure functions go in utils:**
- Deletion-related transformations: `recursivelyMarkAsDeleted()` lives in actions (modifies state)
- Generic helpers: `getVisibleChildren()` lives in utils (pure filter function)

**Rationale:**
- Keeps related operations together in focused files
- Store composes actions directly without extra indirection
- Each module has single responsibility
- Avoids unnecessary composition layers when only spreading actions
- Tests organized in subdirectories for cleaner file structure

## Action Factory Function Convention

**Decision:** Define actions as separate named functions, return references to them.

**Pattern:**
```typescript
// ✅ CORRECT
export const createNodeActions = (get, set, triggerAutosave?): NodeActions => {
  function selectNode(nodeId: string, cursorPosition?: number): void {
    set({ selectedNodeId: nodeId, cursorPosition: cursorPosition ?? 0 });
  }

  function updateContent(nodeId: string, content: string): void {
    const { nodes } = get();
    set({ nodes: { ...nodes, [nodeId]: { ...nodes[nodeId], content } } });
    triggerAutosave?.();
  }

  return { selectNode, updateContent };
};

// ❌ INCORRECT - Inline arrow functions
export const createNodeActions = (get, set, triggerAutosave?): NodeActions => ({
  selectNode: (nodeId, cursorPosition?) => { /* ... */ },
  updateContent: (nodeId, content) => { /* ... */ },
});
```

**Scope:**
- ✅ Action factories: `createNodeActions`, `createFileActions`, etc.
- ❌ Zustand stores: `useFilesStore`, `useToastStore` (use standard Zustand pattern)

**Rationale:**
- Actions defined inside factory capture `get`, `set`, and `triggerAutosave` via closure
- Named functions provide better stack traces than arrow functions
- Consistency, better readability, easier to maintain

## Function Size and Complexity

**Decision:** Keep functions small and focused. A function should do one thing well.

**Guidelines:**
- **Target:** 10-20 lines per function
- **Maximum:** 30 lines (if exceeding, refactor)
- **Single responsibility:** Each function has one clear purpose
- **Extraction rule:** If you need a comment to explain a block, extract it to a named function

**When to extract:**
- Block needs comment → Extract to named function
- Repeated logic → Extract to shared helper
- Function exceeds 30 lines → Break into smaller functions
- Nested control flow → Extract inner logic

**Rationale:**
- Function names replace comments
- Small units easier to test and maintain
- Reduces cognitive load

## Multi-File Tree Store Architecture

**Decision:** Use factory pattern with context provider. Each open file gets its own independent tree store instance.

**Problem:** Singleton stores don't work when multiple files are open simultaneously.

**Solution:** `createTreeStore()` factory + `StoreManager` + `TreeStoreContext`

**Structure:**
- `createTreeStore()` - Factory creates independent store instances
- `storeManager.getStoreForFile(path)` - One store per file path
- `TreeStoreContext` - Provides store to components without prop drilling
- `useStore(selector)` - Hook to access store via context

**Usage:**
```typescript
// Components access store via context
const node = useStore((state) => state.nodes[nodeId]);
const selectAndEdit = useStore((state) => state.actions.selectAndEdit);
```

**Rationale:**
- Each file needs isolated state
- Context allows switching active store without re-mounting tree
- No singleton limitations

## Multi-File vs Single-File Actions Separation

**Decision:** Separate file-related actions into two distinct layers: workspace orchestration (files store) and document persistence (tree store).

**Problem:** Initially both were named `fileActions`, causing confusion about responsibilities.

**Solution:** Clear naming and separation of concerns.

**Structure:**

**`files/actions/fileActions.ts`** - Workspace orchestration layer
- Manages multi-file operations (tabs, workspace state)
- Coordinates across multiple tree stores via `storeManager`
- Handles user-facing workflows (dialogs, confirmations)
- Actions: `openFileWithDialog()`, `createNewFile()`, `closeFile()`, `saveActiveFile()`, `loadAndOpenFile()`

**`tree/actions/persistenceActions.ts`** - Document persistence layer
- Manages single-document I/O operations
- Operates on one tree store instance
- Handles file format serialization/deserialization
- Actions: `loadFromPath()`, `saveToPath()`, `autoSave()`, `initialize()`, `setFilePath()`

**Architecture Flow:**
```
User Action (Menu/Hotkey)
    ↓
files/fileActions (orchestration)
    ↓
storeManager.getStoreForFile(path)
    ↓
tree/persistenceActions (I/O)
    ↓
StorageService (platform implementation)
```

**Example:**

```typescript
// files/fileActions - Orchestrates multiple files
export const createFileActions = (get, storage): FileActions => ({
  openFileWithDialog: async () => {
    const path = await storage.showOpenDialog();  // Dialog interaction
    const store = storeManager.getStoreForFile(path);  // Get/create tree store
    await store.getState().actions.loadFromPath(path);  // Delegate to persistence
    openFile(path, displayName);  // Update workspace tabs
  }
});

// tree/persistenceActions - Single document I/O
export const createPersistenceActions = (get, set, storage): PersistenceActions => ({
  loadFromPath: async (path) => {
    const data = await storage.loadDocument(path);  // Load from disk
    set({ nodes: data.nodes, rootNodeId: data.rootNodeId });  // Update tree
    return { created: data.created, author: data.author };
  }
});
```

**Dependency Injection Pattern:**

Both action creators use dependency injection for the storage service:

```typescript
// Platform layer exports with abstraction
// src/platforms/index.ts: export { Storage as StorageService }
import { StorageService } from '@platform';  // Actually imports Storage class

// Store instantiates and injects
const storageService = new StorageService();
const actions = createFileActions(get, storageService);

// Actions receive injected dependency (interface type)
export const createFileActions = (get, storage: StorageService) => ({
  // Use storage parameter, not direct import
});
```

**Benefits:**
- ✅ Platform switching via `@platform` alias (Electron ↔ Web)
- ✅ Testable via mock injection
- ✅ Clear separation of concerns
- ✅ No naming confusion

**Rationale:**
- Files actions manage the workspace (which files are open)
- Persistence actions manage individual documents (load/save operations)
- Separation allows tree store to be used independently of workspace
- Each layer has a single, well-defined responsibility
- Dependency injection enables testing and platform independence

## Session Persistence

**Decision:** Session state stored via platform-abstracted storage, tracking all open files in order (including temporary files).

**Implementation:**
- `SessionState` interface: `{ openFiles: string[], activeFilePath: string | null }`
- Files store persists session after open/close/setActive/markAsSaved operations
- Electron: stored in `userData/session.json` via IPC handlers
- Session includes both saved and temporary files to preserve tab order
- `initializeSession()` restores files in session order, then any orphaned temp files

**Rationale:**
- Platform abstraction enables future web version (localStorage/server storage)
- Session managed at workspace level (files store), not document level (tree store)
- All open files remembered in exact order (not just saved files)
- Including temp files preserves natural tab order users expect

## Drag-and-Drop with Multi-Select

**Decision:** Use @dnd-kit with standard desktop multi-select patterns (Ctrl/Cmd+Click, Shift+Click). Hierarchical selection auto-selects descendants.

**Implementation:**
- **DndContext** wraps entire tree (one context, not per-node)
- Each **TreeNode** is both draggable and droppable
- **Drop zones**: top 25% (before), middle 50% (child), bottom 25% (after)
- **Multi-select state**: `selectedNodeIds: Set<string>`, `lastSelectedNodeId` (anchor for range)
- **Hierarchical rule**: Selecting a node auto-selects all descendants (visual matches behavior)
- **Move filtering**: `getNodesToMove()` excludes descendants of selected ancestors (prevents duplicates)

**Performance:**
- Store access via `store.getState()` in event handlers (no subscriptions per node)
- Drop position listener only active on hovered node
- Optimized re-renders: ~2-3 nodes per mouse move during drag, not all nodes

**Rationale:**
- Familiar UX from file explorers and IDEs
- Visual selection matches what actually moves (parent moves → children move)
- Filtering duplicates prevents tree corruption
- Minimal re-renders maintain performance with large trees

## Testing Strategy

**Decision:** Organize tests in `tests/` subdirectories within their module directories. Follow Test-Driven Development (TDD) principles when practical.

**Test Organization:**
```
src/renderer/test/
├── setup.ts                      # Global test setup (mocks, matchers)
├── helpers/                      # Shared test utilities
│   └── mockStoreActions.ts
└── integration/                  # Integration tests
    ├── fileSaveLoad.test.ts
    ├── unsavedChanges.test.ts
    ├── tempFileLifecycle.test.ts
    └── multiFileState.test.ts

src/renderer/components/Tree/
├── Tree.tsx
├── tests/
│   └── Tree.test.tsx             # Component tests

src/renderer/components/Tree/hooks/
├── useTree.ts
└── tests/
    └── useTree.test.tsx          # Hook tests

src/renderer/store/tree/actions/
├── nodeActions.ts
└── tests/
    └── nodeActions.test.ts       # Action tests

src/renderer/services/
├── cursorService.ts
└── tests/
    └── cursorService.test.ts     # Service tests
```

**Test Types:**

1. **Unit Tests** - Test single units in isolation
   - Store actions (business logic)
   - Individual components (rendering, props)
   - Utility functions
   - Custom hooks
   - Fast execution (<10ms per test)

2. **Integration Tests** - Test multiple units together across system boundaries
   - Full data flows: UI → stores → IPC → Storage → Filesystem
   - Critical user workflows (save/load, unsaved changes dialogs, multi-file management)
   - Data integrity validation (no loss through save/load cycles)
   - Temp file lifecycle management
   - Cross-store coordination (filesStore + storeManager + treeStore)
   - Slower execution (involves multiple state changes and mock IPC calls)

3. **E2E Tests** - Not implemented yet (Electron requires special setup)

**Run Tests:**
```bash
npm test                  # Run all tests in watch mode
npm run test:run          # Run all tests once
npm run test:coverage     # Run tests with coverage report
```

**Coverage Configuration:**
- **Provider:** V8 (faster than Istanbul)
- **Reporters:** text, json, html, lcov
- **Current Coverage:** 85.55% (812 tests)
- **Target Thresholds:** 70% (2025 industry standard for production)

**Integration Test Suite:**

Four integration tests validate critical data integrity workflows:

1. **fileSaveLoad.test.ts** - Save/load round trip preserves all data (content, structure, metadata)
2. **unsavedChanges.test.ts** - Dialog flow for temp files (Save/Don't Save/Cancel)
3. **tempFileLifecycle.test.ts** - Temp file creation, cleanup, orphan recovery
4. **multiFileState.test.ts** - Multiple files with independent state, session persistence

**Pattern:** Realistic mock implementations with stateful storage (Map-based file system, temp file tracking). Use `vi.clearAllMocks()` before test operations to isolate assertions.

**What to Test:**
- ✅ Store actions (business logic)
- ✅ UI components (user interactions)
- ✅ Custom hooks (data hooks with return values)
- ❌ Barrel exports (index.ts files)
- ❌ Type definitions
- ❌ Electron main/preload (requires different approach)

**TDD Approach:**
- Write tests before implementing features when possible
- Identify edge cases and error conditions early
- Use tests to drive API design (forces thinking about interfaces)
- Build confidence through rapid feedback
- Refactor safely with test coverage

**When to use TDD:**
- ✅ New features with clear requirements
- ✅ Bug fixes (write failing test first, then fix)
- ✅ Services and business logic (pure functions)
- ✅ Complex state management operations
- ⚠️  Exploratory UI work (tests can follow once design solidifies)
- ⚠️  Rapid prototyping (add tests after validating approach)

**Rationale:**
- Tests stay with their modules but in organized subdirectories
- Moving/deleting modules also moves/deletes test directories
- Cleaner file structure without cluttering source directories
- Vitest integrates seamlessly with Vite (same config, faster builds)
- Coverage thresholds ensure minimum quality bar
- Focus on testing behavior, not implementation details
- TDD catches bugs earlier and produces better-designed code

## Services Organization

**Decision:** Services handle infrastructure layer concerns - external interactions with DOM, IPC, browser APIs, and file I/O. Platform-specific implementations live in `src/platforms/`.

**Structure:**
```
src/renderer/services/
├── cursorService.ts        # DOM Selection API manipulation
└── logger.ts               # Logging and toast notifications

src/platforms/
├── index.ts                # Platform services exports
└── electron/               # Electron-specific implementations
    └── services/           # Platform service implementations
        ├── Storage.ts      # Storage class
        ├── Menu.ts         # Menu class
        └── ErrorHandler.ts # ErrorHandler class

src/shared/
└── interfaces.ts           # Shared interface definitions
```

**Example:**
```typescript
// services/cursorService.ts - DOM interaction service
export const getCursorPosition = (element: HTMLElement): number => {
  const selection = window.getSelection(); // Browser API
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
};

// Usage in hooks or components
import { getCursorPosition, setCursorPosition } from '../../services/cursorService';
```

**Rationale:**
- Services handle external interactions (DOM, IPC, browser APIs, file I/O)
- Services can have side effects
- Examples: cursor position in DOM, file operations via IPC, keyboard event registration
- Services need mocking in tests
- Architecture layers: Components → Hooks → Store Actions → Services

## Utils Organization

**Decision:** Utils contain pure functions with no side effects. Renderer utils are for renderer-specific logic, shared utils are for cross-platform logic.

**Structure:**
```
src/renderer/utils/          # Renderer-specific pure functions
├── position.ts              # Coordinate-based cursor position calculations
├── ancestry.ts              # Tree ancestor registry operations
└── hotkeyUtils.ts           # Hotkey pattern matching

src/shared/utils/            # Platform-agnostic pure functions
└── fileNaming.ts            # Untitled file numbering logic
```

**When to use each:**

**Renderer Utils** (`src/renderer/utils/`):
- Pure functions used by renderer code (components, hooks, stores)
- Examples: DOM coordinate calculations, tree traversal, hotkey matching
- Called by: Components, hooks, store actions

**Shared Utils** (`src/shared/utils/`):
- Pure functions used by platform implementations
- Platform-agnostic business logic
- Examples: file naming patterns, validation rules, formatting
- Called by: Platform services (Electron, Web), main process, renderer

**Rationale:**
- Utils are pure functions with no side effects
- Clear separation: renderer-specific vs platform-agnostic
- Shared utils can be reused across Electron and Web platforms
- Utils do not need mocking in tests (pure input/output)
- Easy to test and reason about
- Architecture layers: Components → Hooks → Store Actions → Utils

## Zustand Store Testing Pattern

**Decision:** Use official Zustand testing pattern with `__mocks__/zustand.ts` for automatic store reset between tests.

**Reference:** [Official Zustand Testing Guide](https://zustand.docs.pmnd.rs/guides/testing)

**Implementation:**
- `__mocks__/zustand.ts` - Intercepts `create()` to capture initial state and enable automatic reset
- `src/renderer/test/setup.ts` - Calls `vi.mock('zustand')` to enable the mock
- `src/renderer/test/helpers/mockStoreActions.ts` - Helper functions to create mock actions
- Component tests create store instances and provide via TreeStoreContext

**Testing Pattern:**
```typescript
// Create a store instance for testing
let store: TreeStore;

beforeEach(() => {
  store = createTreeStore();
  store.setState({
    nodes: {},
    rootNodeId: 'test-node',
    selectedNodeId: null,
    // ... other state
    actions: {
      selectAndEdit: vi.fn(),
      updateStatus: vi.fn(),
      // ... other actions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any, // Partial mocks need type assertion
  });
});

// Wrap test component with context provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
);

const { result } = renderHook(() => useStore((state) => state.selectedNodeId), { wrapper });
```

**Why `as any` is needed:**

The `TreeState.actions` interface requires all methods from NodeActions, NavigationActions, PersistenceActions, and TreeStructureActions. Tests only mock the specific methods they need. The `as any` type assertion is **standard practice** for partial mocks - the alternative (mocking all methods in every test) is verbose and obscures test intent.

**Benefits:**
- Tests use real Zustand store (not custom mock implementations)
- Store automatically resets between tests
- Eliminated 150+ lines of custom mock code
- Type-safe state manipulation
- Follows official Zustand recommendations

## Ancestor Registry for Tree Traversal

**Decision:** Use a flat ancestor registry with hash IDs instead of recursive tree traversal for ancestry checks.

**Problem:** Recursive functions like `isDescendant()` perform O(n) tree walking on every operation, causing performance issues as trees grow.

**Solution:** Maintain a flat registry mapping each node ID to its ancestor chain.

**Implementation:**
```typescript
interface TreeState {
  ancestorRegistry: Record<string, string[]>;
}

// Example registry
{
  'abc123': [],                    // root node
  'def456': ['abc123'],            // child of root
  'ghi789': ['abc123', 'def456'],  // grandchild
}

// O(k) lookup instead of O(n) recursion
function isDescendant(parentId: string, targetId: string | null): boolean {
  return ancestorRegistry[targetId]?.includes(parentId) ?? false;
}
```

**Registry Utils (`utils/ancestry.ts`):**
- `buildAncestorRegistry()` - Builds initial registry when loading tree
- `isDescendant()` - Fast ancestry check using array includes

**Performance:**
- isDescendant: O(n) recursion → O(k) array lookup (k = tree depth, typically 5-20)
- Handles 10,000+ nodes without performance degradation
- Ready for future lazy loading and web worker optimization

**Future Scaling:**
When implementing lazy loading (partial tree loading), only loaded branches need registry entries. When moving nodes, rebuild registry only for the moved subtree, not the entire tree.

**Rationale:**
- Eliminates recursive tree walking on every collapse/expand
- Scales to large trees without performance bottlenecks
- Simple data structure (plain object with arrays)
- Uses existing hash IDs (no new position/indexing system needed)
- Prepares architecture for lazy loading features

## Coordinate-Based Cursor Positioning

**Decision:** Implement coordinate-based cursor positioning for contentEditable elements.

**Problem:** ContentEditable has a limitation where clicking on padding/gaps between elements places the cursor at position 0 (start) instead of the natural click position.

**Solution:** Calculate cursor position from click coordinates by measuring distance to each character position. Handled in `useNodeClick` hook and `utils/position.ts`.

**Trade-off:** Adds ~60 lines of code complexity but provides natural cursor positioning UX. Similar approach used by professional code editors like Monaco.

## Visual Effects Actions

**Decision:** Visual effects triggered by actions belong in store, in a dedicated `visualEffectsActions.ts` file.

**Structure:**
```
store/tree/actions/
├── nodeActions.ts
├── navigationActions.ts
├── visualEffectsActions.ts    # Visual effects (flash, highlight, etc.)
└── ...
```

**Pattern:**
```typescript
// visualEffectsActions.ts
function flashNode(nodeId: string): void {
  set({ flashingNodeId: nodeId });
  setTimeout(() => set({ flashingNodeId: null }), 2000);
}

// nodeMovementActions.ts
if (isCollapsed && visualEffects) {
  visualEffects.flashNode(newParentId);
}

// Component reads flash state
const isFlashing = useStore((state) => state.flashingNodeId === nodeId);
```

**CSS Pattern:**
```css
.node.flashing {
  background-color: var(--blue-100);
  transition: none;  /* Instant on */
}

.node:not(.flashing) {
  transition: background-color 0.5s ease-out;  /* Fade out */
}
```

**Rationale:**
- Direct and performant - effect triggered exactly when action happens
- Separate file keeps visual effects organized and discoverable
- No detecting changes after-the-fact with useEffect
- Timing controlled in one place (visualEffectsActions)

## React Rendering Performance Strategy

**Decision:** Minimize re-renders through selective Zustand subscriptions and React.memo.

**Strategy:**

1. **Subscribe to minimal state** - Only what the component needs
   ```typescript
   const node = useStore((state) => state.nodes[nodeId]);
   ```

2. **Use `getState()` in event handlers** - One-time reads don't need subscriptions
   ```typescript
   const handleToggle = () => {
     const store = useContext(TreeStoreContext);
     const { selectedNodeId, actions } = store!.getState();
   };
   ```

3. **Conditional subscriptions** - Return same value for non-relevant components
   ```typescript
   const cursorPosition = useStore((state) =>
     state.selectedNodeId === node.id ? state.cursorPosition : 0
   );
   ```

4. **React.memo** - Prevent prop-driven re-renders (use selectively)
   ```typescript
   export const Node = memo(function Node({ nodeId }: NodeProps) { ... });
   ```

   **When to use memo:**
   - ✅ TreeNode (recursive, many instances, stable props)
   - ✅ Tree (top-level, prevents cascade re-renders)
   - ✅ Workspace (top-level, complex subtree)
   - ❌ Small components (StatusCheckbox, ExpandToggle) - comparison cost > render cost
   - ❌ Components with frequently changing props - memo overhead without benefit

5. **Maintain referential equality** - Use spread operators correctly when updating state

**Result:** Only affected components re-render. Editing one node doesn't re-render the entire tree.

**Rationale:** Critical for large trees (100+ nodes). Follows Zustand best practices for performance.

## React Strict Mode

**Decision:** Strict Mode is disabled for this Electron desktop application.

**Why Strict Mode exists:**
- Detects unsafe lifecycles (mostly for legacy class components)
- Warns about deprecated React APIs
- Double-invokes effects to help catch side effect bugs
- Prepares for React's concurrent rendering features

**Why it's disabled for Arborescent:**

1. **Dev/Prod parity is critical** - Strict Mode causes development to behave differently from production by double-invoking effects. For a desktop app with real file I/O and IPC operations, this creates false bugs (e.g., creating two temp files instead of one) that don't exist in production. Testing against production behavior is more valuable.

2. **Modern patterns already in use** - The entire codebase uses functional components, hooks, and no legacy APIs. The warnings Strict Mode provides for class components and deprecated APIs don't apply.

3. **Desktop app context** - This is not a complex web application needing concurrent rendering optimization. The performance benefits of preparing for concurrent features are minimal.

4. **Side effects are intentional** - File I/O, IPC calls to Electron main process, and localStorage operations are real side effects that should only execute once. Double-invoking these creates actual problems rather than revealing bugs.

**Example of the problem:**
```typescript
// In App.tsx initialization
useEffect(() => {
  const initializeApp = async () => {
    const tempPath = await storageService.createTempFile(arboFile);
    // With Strict Mode: This runs twice in dev, creating two temp files
    // Without Strict Mode: This runs once, matching production behavior
  };
  initializeApp();
}, []);
```

**Location:** `src/renderer/renderer.tsx` renders `<App />` directly without `<React.StrictMode>` wrapper.

**Rationale:** For Electron desktop apps with system-level side effects, dev/prod consistency outweighs the benefits of Strict Mode's double-invocation checks.

## Plugin Architecture

**Decision:** VS Code-inspired plugin system with worker thread process isolation, serializable data pattern, command registry, and IPC-based communication.

**Structure:**
```
src/shared/types/
└── plugins.ts              # Plugin interface definitions (shared contract)

plugins/core/
├── renderer/
│   ├── Manager.ts          # IPC coordination (renderer → main → worker)
│   ├── Registry.ts         # Renderer-side tracking (UI state, enable/disable)
│   ├── CommandRegistry.ts  # Command execution (renderer process)
│   ├── Proxy.ts            # Forwards calls to worker via IPC
│   └── initializePlugins.ts # Plugin initialization
├── main/                   # Worker thread coordination
│   ├── WorkerConnection.ts # Worker lifecycle management
│   ├── IPCBridge.ts        # Plugin API handler registry
│   ├── ipcSystemHandlers.ts # Plugin system lifecycle handlers
│   ├── loadHandlers.ts     # Dynamic handler loading
│   └── registerHandlers.ts # Handler registration
├── worker/                 # Worker thread (plugin execution)
│   ├── API.ts              # Low-level IPC
│   ├── Context.ts          # Plugin API surface
│   ├── worker.ts           # Worker thread entry point
│   └── services/
│       └── Logger.ts       # Worker logging
├── shared/                 # Shared types
│   ├── interface.ts        # Plugin interfaces
│   ├── config.ts           # Config types
│   └── apiVersion.ts       # API version constants
└── preload/                # IPC bridge
    └── preload.ts          # Secure IPC bridge

plugins/[plugin-name]/
├── main/                   # Plugin implementation + IPC handlers
└── renderer/               # Command handlers + UI components
```

**Architecture Flow:**
```
Renderer ←→ IPC ←→ Main Process ←→ Worker Thread
                                      ↓
                                   Plugin
                                      ↓
                            PluginContext (typed API)
                                      ↓
                              PluginIPCBridge
                                      ↓
                               IPC Handlers
```

**Key Components:**
- **Manager (renderer):** Coordinates worker lifecycle via IPC, creates Proxy instances (Manager.ts)
- **Registry (renderer):** Tracks enabled plugins, updates UI state (Registry.ts - Zustand store)
- **CommandRegistry (renderer):** Maps plugin commands to renderer actions (CommandRegistry.ts)
- **Proxy (renderer):** Forwards extension point calls to worker via IPC (Proxy.ts)
- **WorkerConnection (main):** Manages worker thread lifecycle (WorkerConnection.ts)
- **worker (worker):** Loads and executes plugins in isolation (worker.ts)
- **Context (worker):** Typed API surface that provides secure methods to plugins (Context.ts)
- **IPCBridge (main):** Secure IPC handler registry for plugin-accessible APIs (IPCBridge.ts)

**Plugin Extension Points:**
```typescript
interface PluginExtensionPoints {
  provideNodeContextMenuItems?(node: TreeNode, context: NodeContext):
    PluginContextMenuItem[];  // { id, label } not { onClick }
  provideNodeIndicator?(node: TreeNode):
    PluginNodeIndicator | null;  // { type: 'text', value: '🤖' }
}
```

**Command Pattern:**
```typescript
// Plugin registers commands (renderer process)
PluginCommandRegistry.register('claude-code:send-to-session', async (context) => {
  // Command logic with access to renderer state
});

// Plugin returns menu item (worker thread)
{ id: 'claude-code:send-to-session', label: 'Send to Session...' }

// UI executes command (renderer process)
PluginCommandRegistry.execute(item.id, { node });
```

**Plugin API (Worker Thread):**
```typescript
export class MyPlugin implements Plugin {
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async initialize(): Promise<void> {
    // Use typed methods from PluginContext
    const projectPath = await this.context.getProjectPath();
    const sessions = await this.context.listClaudeSessions(projectPath);
  }
}
```

**Rationale:**
- **Plugin Types in Shared**: Plugin interface types live in `src/shared/types/plugins.ts` as the contract between core and plugins, preventing core components from depending on `plugins/` directory
- **PluginContext Injection**: Plugins receive context via constructor, eliminating tight coupling to worker implementation
- **Process Isolation**: Plugins run in separate worker thread for security and stability
- **Serializable Data**: All extension points return JSON-serializable data for IPC transport
- **Command Pattern**: Commands run in renderer with access to UI state, while menu definitions come from worker
- **IPC Architecture**: Main process manages worker thread, renderer communicates via IPC
- **Error Isolation**: Plugin crashes don't affect renderer; try/catch around all invocations
- **Security**: Untrusted plugins can't directly access renderer state or DOM

**See also:** `plugins/PLUGIN_DEVELOPMENT.md` for complete plugin development guide

## Shared Logger Architecture

**Decision:** Base logger class with platform-specific implementations for main and renderer processes.

**Structure:**
```
src/shared/services/logger/
├── LoggerInterface.ts       # Logger interface
└── BaseLogger.ts            # Base implementation with common logic

src/main/services/
└── logger.ts                # MainLogger extends BaseLogger

src/renderer/services/
└── logger.ts                # RendererLogger extends BaseLogger
```

**Pattern:**
```typescript
// Base logger provides common functionality
export abstract class BaseLogger implements Logger {
  protected logs: LogEntry[] = [];
  protected maxLogs = 1000;

  debug(message: string, context?: string): void {
    this.log('debug', message, context);
  }

  abstract error(message: string, error?: Error, context?: string): void;

  protected log(level: LogLevel, message: string, context?: string, error?: Error): void {
    // Common logging logic
  }
}

// Platform-specific implementations
class MainLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string, notifyRenderer = true): void {
    this.log('error', message, context, error);
    if (notifyRenderer) {
      mainWindow.webContents.send('main-error', message);
    }
  }
}

class RendererLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string, showToast = true): void {
    this.log('error', message, context, error);
    if (showToast) {
      this.toastCallback?.(message, 'error');
    }
  }
}
```

**Usage in Plugins:**
```typescript
import { logger } from '../../../src/renderer/services/logger';

logger.info('Plugin initialized', 'Claude Plugin');
logger.error('Failed to load sessions', error, 'Claude Plugin');
```

**Rationale:**
- Shared base implementation eliminates code duplication
- Platform-specific implementations handle process-specific concerns (BrowserWindow notifications, toasts)
- Plugins can use logger without depending on process type
- Single interface ensures consistent logging API across codebase
- Context parameter enables filtering logs by module
- Base logger tested once, inherited by both implementations
