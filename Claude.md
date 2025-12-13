# Arborescent - Development Context

## Project Overview

**Arborescent** is a cognitive scaffolding tool for complex thinking and AI collaboration. It organizes work in hierarchical trees with reusable contexts that automatically attach when sending content to AI.

## Tech Stack

- **Desktop:** Electron + Vite + Electron Forge
- **Frontend:** React 19 + TypeScript (strict mode)
- **Styling:** Plain CSS with custom properties
- **State:** Zustand (organized actions pattern)
- **Drag & Drop:** @dnd-kit
- **Terminal:** xterm.js

## Architecture

```
src/
├── main/           # Electron main process
│   └── services/   # IPC handlers by feature
├── preload/        # Context bridge (single file)
├── renderer/       # React app
│   ├── components/ # UI with co-located hooks/styles
│   ├── store/      # Zustand stores with actions/
│   ├── services/   # Side effects (keyboard, feedback, etc.)
│   ├── hooks/      # Shared hooks
│   ├── utils/      # Pure utility functions
│   └── data/       # Static data and config
└── shared/         # Cross-process types and utils
```

## Key Features

- **Tree-based decomposition** - Unlimited nesting, keyboard-first navigation
- **Reusable contexts** - Define once, apply anywhere, inherited by children
- **Blueprints** - Export workflow structure without content for sharing
- **AI collaboration** - Right-click to send to browser or terminal with context attached
- **Terminal integration** - Built-in terminal emulator with file watching for AI responses
- **Multi-file support** - Tabbed interface with session persistence

## Conventions

### Code Organization
- Components hold templates only; hooks hold logic
- Business logic in store actions, not components
- Services for side effects (DOM, IPC, I/O)
- Utils are pure functions
- Co-locate single-use code; centralize shared code

### State Management
- Zustand stores in `store/` directory
- Actions organized by domain in separate files
- Use `getState()` in event handlers (no subscription overhead)

### Testing
- Tests in `tests/` subdirectories within modules
- Mock services via dependency injection
- Integration tests for critical workflows only

### Styling
- Plain CSS with custom properties in co-located `.css` files
- Theme variables in `globals.css`
- No inline styles

### Comments
- Comments explain "why" not "what"
- Prefer descriptive naming over comments
- No JSDoc conventions

## Commands

```bash
npm start           # Development
npm run test:run    # Run tests
npm run lint        # Lint check
npm run type-check  # TypeScript check
npm run make        # Build installer
```

## For AI Assistants

1. **Read files before editing** - Understand existing code first
2. **Follow existing patterns** - Check similar code in the codebase
3. **Avoid over-engineering** - Only what's needed for the task
4. **Don't commit** - User handles all git operations
5. **Run checks** - `npm run type-check && npm run lint && npm run test:run`

## File Format

`.arbo` files are YAML-based, human-readable, version-control friendly.
