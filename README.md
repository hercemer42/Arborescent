# Arborescent

**Cognitive scaffolding for complex thinking and AI collaboration.**

Structure your thinking. Supercharge your AI interactions. Share what works.

![Screenshot placeholder](docs/screenshot.png)

## Why Arborescent?

AI is only as good as the context you give it. Arborescent lets you build that context once, refine it over time, and reuse it everywhere.

## What it does

Arborescent lets you decompose projects as trees, with reusable contexts that automatically attach when you send any part of your work to an AI. Refine what works, and every future collaboration gets better.

The blueprint feature lets you export the meta-structure—your workflow logic without the project content—so you can share it with a team, refine it together, or contribute it to the community.

## Key features

- **Tree-based decomposition** — Break complex projects into manageable parts with unlimited nesting
- **Reusable contexts** — Define contexts once, apply them to any node. Child nodes inherit parent contexts automatically. When you refine a context, every node using it improves.
- **Blueprints** — Export your workflow structure stripped of project content. Share your organizational logic with others, or import theirs.
- **Keyboard-first editing** — Navigate with arrow keys, create with Enter, restructure with Tab
- **Two-click AI export** — Right-click any node, send to any AI in the browser or terminal to build or review

### Also includes

- Multi-file support with tabbed interface and session persistence
- Status tracking (incomplete/complete/blocked)
- Drag and drop with multi-select
- Integrated terminal emulator
- Plugin system (Claude Code integration included)

## Quick start

1. [Download the latest release](https://github.com/yourrepo/arborescent/releases)
2. Open Arborescent and create a new file
3. Build your tree: Enter creates siblings, Tab indents, arrow keys navigate
4. Right-click any node → "Contexts" to attach reusable context
5. Right-click any node → "Send to AI" to export with context attached

## Philosophy

Designed for focus and low cognitive load:

- Tree structure supports non-linear thinking
- UI minimizes visual noise
- Predictable, stable behavior
- Complexity is emergent, discoverable, configurable

## Example blueprints

- [React + Electron Development](blueprints/react-electron.arbo) — Full dev workflow with conventions, contexts for features/bugs/refactoring, and standard checks
- More coming soon

## File format

Arborescent uses `.arbo` files (YAML-based) for tree storage with autosave. Human-readable, version-control friendly.

---

## Development

### Tech stack

- **Electron** + **Vite** — Desktop framework and build tooling
- **React 19** + **TypeScript** — UI and type safety
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
- [Creating blueprints](docs/blueprints.md)
- [Plugin development](docs/plugins.md)