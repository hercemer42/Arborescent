# Directory Structure

The source code is organized to clearly separate Electron main process code from renderer (UI) code:

## src/main/
**Electron main process** - Has access to Node.js APIs, file system, OS features

- `main.ts` - Entry point for Electron main process
- `services/`
  - `ipcService.ts` - IPC handler registration for file operations
  - `menuService.ts` - Native application menu creation

## src/renderer/
**React application** - Runs in browser-like sandbox for security

- `renderer.tsx` - Entry point for React app
- `App.tsx` - Main application component
- `components/` - UI components
  - `Tree/` - Tree container component
  - `Node/` - Recursive node component
  - `NodeContent/` - Node content display
  - `ui/` - Reusable UI components (ExpandToggle, StatusCheckbox)
- `hooks/` - Custom React hooks
  - `useFileOperations.ts` - File operation state and handlers
- `services/` - Renderer-side services
  - `fileService.ts` - File serialization/deserialization
- `data/` - Sample/template data
- `design/` - Design system constants
- `globals.css` - CSS custom properties
- `styles.css` - Global resets

## src/shared/
**Shared code** - Used by both main and renderer processes

- `types.ts` - TypeScript type definitions

## src/preload.ts
**Security bridge** - Sits at root level as it bridges main and renderer

Exposes specific APIs from main process to renderer using contextBridge
