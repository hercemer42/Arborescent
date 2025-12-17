# Arborescent

**A tree editor for organizing your AI workflow**

![Screenshot placeholder](docs/screenshot.png)

## What it does

Break down complex problems into tree structures.
Attach contexts to any branch and send as an optimized AI prompt.
Refine your structure and contexts until you get the results you want.

Save what works as a blueprint to share with your team or community. 

## Key features

- **Tree-based decomposition** — Hierarchical structure, drag and drop, keyboard navigation.
- **Reusable contexts** — Define contexts once, apply them to any branch. Changes are inherited automatically.
- **Blueprints** — Share your workflow or import from your community or team.
- **AI integration** — Build your prompt and send it to the integrated terminal or browser.

## Quick start

1. [Download the latest release](__releases__)
2. Build your tree
3. Right-click any branch to send your prompt

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