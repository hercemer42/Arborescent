# Changelog

## Unreleased

### Features

- **Workflow execution**: Declare blueprint branches as workflows with numbered steps, assign step types (Manual, Checkpoint, Autonomous) to control automation level, and run items through workflows with automatic advancement via AI tool hook integration. Supports nested workflows, parallel execution across terminal tabs, and configurable step timeouts
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
