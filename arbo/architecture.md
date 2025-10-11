# Architecture Design Decisions

This document records key architectural choices made during development sessions.

**Date:** 2025-10-11

## Directory Structure

**Decision:** Separate main process (Electron) code from renderer (React UI) code.

**Structure:** See [directory-structure.md](./directory-structure.md) for complete details.

**Rationale:**
- Clear separation between Node.js/Electron code and browser/React code
- Easy to understand what runs where
- Security: renderer code runs in sandbox, main has system access
- Prevents accidental mixing of main and renderer APIs

## Component Organization

**Decision:** Each component lives in its own subdirectory with co-located styles and hooks.

**Structure:**
```
src/renderer/components/ComponentName/
├── ComponentName.tsx
├── ComponentName.css
├── featureName.hook.ts (optional)
└── anotherFeature.hook.ts (optional)
```

**Rationale:**
- Components are self-contained and portable
- Styles and hooks stay with their component
- Easy to move or delete entire features
- Clear ownership of files
- Hook names describe their purpose, not their parent (location already indicates ownership)

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

**Update this file when making new architectural decisions.**
