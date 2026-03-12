# Changelog

## Unreleased

### Features

- **Nested workflows**: Declare workflow steps as sub-workflows with depth-first step numbering, cross-boundary navigation, cascading removal, drag constraints, and full undo/redo support
- **Step types**: Assign Manual, Checkpoint, or Autonomous types to workflow steps via right-click menu, with distinct visual indicators (square/triangle/circle borders) and undoable changes
- **Workflow execution**: Run workflows to automatically advance items through steps, with step-type-aware terminal send, pause/resume, and toast notifications
- **Unified context modes**: Collaborate and Execute modes are now defined on context declarations instead of at send time, simplifying the send menu and making mode a property of the context itself
- **Context indicator refactor**: Context declaration and applied context indicators consolidated with clearer visual hierarchy and tooltips

## 0.1.0 - Initial Release

First public release of Arborescent.

### Features

- Tree-based task decomposition with keyboard-first navigation
- Reusable contexts for AI instructions
- Execute and Collaborate workflows for terminal and browser AI tools
- Blueprint system for shareable workflow templates
- Integrated terminal and browser panels
- Summary mode for filtering by completion date
- Zoom mode for focusing on subtrees
- Drag and drop, multi-select, undo/redo
- YAML-based `.arbo` file format
