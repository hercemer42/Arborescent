# Architecture Design Decisions

This document records key architectural choices made during development sessions.

**Date:** 2025-10-11

## Component Organization

**Decision:** Each component lives in its own subdirectory with co-located styles.

**Structure:**
```
src/components/ComponentName/
├── ComponentName.tsx
└── ComponentName.styles.ts
```

**Rationale:**
- Components are self-contained and portable
- Styles stay with their component
- Easy to move or delete entire features
- Clear ownership of files

## Style File Separation

**Decision:** Component styles live in separate `.styles.ts` files, imported by the component.

**Example:**
```typescript
// ComponentName.styles.ts
export const styles = {
  container: 'flex items-center gap-2',
};

// ComponentName.tsx
import { styles } from './ComponentName.styles';
```

**Rationale:**
- Separates concerns (logic vs presentation)
- Keeps component files focused on behavior
- Makes styles easy to find and modify
- Component-specific styles stay with component, not in global theme

## Node Type Configuration

**Decision:** Node types (icons, styles) are user-definable data, not hardcoded in components.

**Implementation:**
```typescript
// In data
nodeTypeConfig: {
  project: { icon: '📁', style: 'text-blue-700 font-bold' },
  task: { icon: '', style: 'text-gray-800' }
}

// In component
const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
```

**Rationale:**
- Users can define custom node types without code changes
- Makes the system more flexible
- Component logic doesn't need to know about specific types

## Global CSS Reset

**Decision:** Use a global CSS reset for buttons in `src/index.css` instead of repeating reset classes in components.

**Implementation:**
```css
/* src/index.css */
button {
  border: none;
  background: transparent;
  padding: 0;
  outline: none;
  font-family: inherit;
  cursor: pointer;
}
```

**Rationale:**
- Pragmatic approach - avoids repetition across all button components
- All buttons in the app are minimal UI controls (no styled buttons planned)
- Simpler component styles - just color and size classes needed
- Can override with Tailwind classes if needed later

**Update this file when making new architectural decisions.**
