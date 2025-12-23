# Arborescent

**An outliner for project decomposition and AI workflows**

## What it does

Break down complex projects into hierarchical task lists.  
Build and execute AI prompts with reusable contexts.  
Share your workflows with your community or team.  

## Why Arborescent?

AI works best when you tell it exactly what you want.  
Arborescent keeps you in control, supercharging your AI workflow.  
Free and open source under GPL.  

Here is Arborescent building itself:

![Arborescent building Arborescent](docs/screenshot.png)

## Key features

- **Tree-based decomposition** — Fully featured outliner with keyboard navigation and drag and drop.
- **AI integration** — Build your prompt and send it to the integrated terminal or browser.
- **Reusable contexts** — Define contexts once, apply them to any branch. Changes are inherited automatically.
- **Blueprints** — Export your core workflow or import from your community or team.

## Quick start

1. [Download the latest release](https://gitlab.com/hercemer42/Arborescent/-/releases)
2. Break down your task
3. Open your preferred AI in the terminal or browser
4. Right-click to send your prompt

## Example blueprints

- [React + Electron Development](blueprints/react-electron-blueprint.arbo) — Dev workflow with conventions and contexts for features/bugs/refactoring.
- [NestJS + React Development](blueprints/nestjs-react-blueprint.arbo) — Dev workflow with backend and frontend conventions.
- [Research Project](blueprints/research-project-blueprint.arbo) — Research workflow with sources, findings, analysis, and review contexts.
- [Team Offsite](blueprints/team-offsite-blueprint.arbo) — Plan team offsites with sessions, logistics, and budget.

## Learn more

- [Documentation](docs/README.md)

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
