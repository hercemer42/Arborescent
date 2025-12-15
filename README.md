# Arborescent

**Cognitive scaffolding for critical thinking and AI collaboration.**

Distill your thoughts.  Refine your context.  Compound your results.

![Screenshot placeholder](docs/screenshot.png)

## Why Arborescent?

AI is at its best when the human is in the driver's seat.  Arborescent keeps you there.

## What it does

Decompose and execute your ideas with AI collaboration. Refine your contexts through feedback loops. Every collaboration gets more precise.

Blueprints let you encode and share that expertise, or import it from your team or community. What one person knows, everyone does.

## Key features

- **Tree-based decomposition** — Hierarchical structure, drag and drop, keyboard-first navigation.
- **Reusable contexts** — Define contexts for each need, apply them to any branch. Changes are inherited automatically.
- **Blueprints** — Encode and share your workflow. Import expertise from your community or team.
- **AI integration** — Send any branch to browser or terminal AI to build or review.
- **Integrated terminal and browser** — No context switching, optimized for flow.

## Quick start

1. [Download the latest release](releases)
2. Open Arborescent and create a new file.
3. Build your tree: Enter creates a new branch, Tab indents, arrow keys navigate. [Full documentation here.](docs/README.md)
4. Right-click any branch → "Blueprint" → "Declare as context" to declare it as context for an AI.
5. Right-click any branch → "Execute or Collaborate", tag the context, send it to the browser or terminal.
6. Right-click any branch → "Blueprint" → "Add to blueprint", declare it as meta-structure for export.

## Example blueprints

- [React + Electron Development](blueprints/react-electron.arbo) — Full dev workflow with conventions, contexts for features/bugs/refactoring, and standard checks
- More coming soon

## File format

Arborescent uses `.arbo` files which are YAML based to be human-readable and version-control friendly.

---

## Development

### Tech stack

- **Electron** + **Vite** — Desktop framework and build tooling
- **React** + **TypeScript** — UI and type safety
- **Zustand** — State management
- **@dnd-kit** — Drag and drop
- **xterm.js** — Terminal emulation

### Setup

```bash
npm install
```

### Scripts

```bash
# Development
npm start

# Tests
npm test              # Watch mode
npm run test:run      # Single run

# Code quality
npm run lint
npm run type-check

# Build
npm run package       # Package the app
npm run make          # Create installers
```

## License

GPL-3.0-only

---

## Learn more

- [Documentation](docs/README.md)