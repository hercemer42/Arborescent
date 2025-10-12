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
│   ├── utils/    # Pure utility functions (domain-specific)
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

## Testing Strategy

**Decision:** Use Vitest with separated unit and integration tests for better organization and test speed. Follow Test-Driven Development (TDD) principles when practical.

**Test Organization:**
```
src/renderer/test/
├── setup.ts                      # Global test setup (mocks, matchers)
├── unit/                         # Fast, isolated tests
│   ├── store/                    # Store action tests
│   ├── components/               # Component rendering tests
│   └── utils/                    # Utility function tests
└── integration/                  # Multi-component tests
    ├── workflows/                # User workflow tests
    └── features/                 # Feature integration tests
```

**Co-located Tests (Preferred):**
```
src/renderer/components/Node/
├── Node.tsx
└── Node.test.tsx                 # Unit test next to component
```

**Test Types:**

1. **Unit Tests** - Test single units in isolation
   - Store actions (business logic)
   - Individual components (rendering, props)
   - Utility functions
   - Custom hooks
   - Fast execution (<10ms per test)

2. **Integration Tests** - Test multiple units together
   - Component interactions
   - Store + component integration
   - User workflows
   - Slower execution (can involve multiple renders)

3. **E2E Tests** - Not implemented yet (Electron requires special setup)

**Run Specific Test Types:**
```bash
npm run test:unit         # Run only unit tests
npm run test:integration  # Run only integration tests
npm test                  # Run all tests in watch mode
```

**Coverage Configuration:**
- **Provider:** V8 (faster than Istanbul)
- **Reporters:** text, json, html, lcov
- **Current Thresholds:** 30% lines, 40% functions (MVP baseline)
- **Target Thresholds:** 70% (2025 industry standard for production)

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
- Vitest integrates seamlessly with Vite (same config, faster builds)
- Coverage thresholds ensure minimum quality bar
- Start conservative, increase as test suite matures
- Focus on testing behavior, not implementation details
- Mock Electron APIs for renderer tests
- TDD catches bugs earlier and produces better-designed code

## Services Organization

**Decision:** Services handle infrastructure layer concerns - external interactions with DOM, IPC, browser APIs, and file I/O.

**Structure:**
```
src/renderer/services/
├── cursorService.ts        # DOM Selection API manipulation
├── fileService.ts          # IPC communication for file operations
├── hotkeyService.ts        # Keyboard event handling
└── logger.ts               # Logging and toast notifications
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

**Decision:** Utils contain pure functions with no side effects for domain logic operations.

**Structure:**
```
src/renderer/utils/
└── [future]                # String manipulation, validation, formatting, etc.
```

**Example (future):**
```typescript
// utils/string.ts - Pure string manipulation
export const truncate = (text: string, maxLength: number): string => {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

// Usage
import { truncate } from '../../utils/string';
```

**Rationale:**
- Utils are pure functions with no side effects
- Examples: string manipulation, number calculations, data transformations, validation
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
- Component tests use `useTreeStore.setState()` directly with real store

**Testing Pattern:**
```typescript
// Use the real store with partial mock actions
const mockActions = createPartialMockActions({
  selectAndEdit: vi.fn(),
  updateStatus: vi.fn(),
});

beforeEach(() => {
  useTreeStore.setState({
    nodes: {},
    // ... other state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: mockActions as any, // Partial mocks need type assertion
  });
});
```

**Why `as any` is needed:**

The `TreeState.actions` interface requires all 14 methods (NodeActions + NavigationActions + FileActions). Tests only mock the specific methods they need. The `as any` type assertion is **standard practice** for partial mocks - the alternative (mocking all 14 methods in every test) is verbose and obscures test intent.

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

**Registry Service:**
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

**Update this file when making new architectural decisions.**
