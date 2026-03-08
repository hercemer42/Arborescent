# Workflows

Organize sequential steps by declaring a blueprint branch as a workflow.

## Declaring a Workflow

Right-click a blueprint branch → **Blueprint** → **Declare as Workflow**. The branch shows a play icon and its children become numbered steps. Children that aren't already blueprints are automatically added.

The parent must be a blueprint. Contexts and their descendants cannot be workflows.

To remove: right-click → **Blueprint** → **Remove from Workflow**. Both actions are undoable with `Ctrl+Z`.

## Moving Items Through Steps

Right-click an item inside a workflow step → **Next step** or **Previous step**. The item physically moves to the adjacent step. Step numbers update automatically when you reorder, add, or remove steps.

## Nesting Workflows

Declare a workflow step as its own workflow to create sub-phases. Step numbers follow depth-first order across the entire tree:

```
Development Pipeline  ← workflow
├── Planning          ← step 1
├── Implementation    ← nested workflow
│   ├── Write code    ← step 2
│   ├── Write tests   ← step 3
│   └── Refactor      ← step 4
└── Review            ← step 5
```

Navigation crosses boundaries automatically — "Next step" from step 1 enters the nested workflow, and "Next step" from step 4 continues to step 5. Collapsed branches expand as needed. "Previous step" reverses the same traversal.

Removing a workflow that contains nested workflows strips workflow status from all descendants. The branches remain as blueprints.

## Dragging Workflows

Drag a workflow into any blueprint node. Drops into non-blueprint nodes, workflow steps, and contexts are rejected with an error message.
