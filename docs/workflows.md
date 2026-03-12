# Workflows

Organize sequential steps by declaring a blueprint branch as a workflow.

## Declaring a Workflow

Right-click a blueprint branch → **Blueprint** → **Declare as Workflow**. The branch shows a play icon and its children become numbered steps. Children that aren't already blueprints are automatically added.

The parent must be a blueprint. Contexts and their descendants cannot be workflows.

To remove: right-click → **Blueprint** → **Remove from Workflow**. Both actions are undoable with `Ctrl+Z`.

## Step Types

Each workflow step has a type that controls how it will be handled during workflow execution. Right-click a step → **Blueprint** → **Step Type** to change it.

- **Manual** (default) — The item waits at the step for you to act. Nothing is sent to the terminal. Indicated by a square border around the step number.
- **Checkpoint** — Content is sent to the terminal, but the workflow pauses when the AI finishes. Indicated by a triangle border.
- **Autonomous** — Content is sent and the item advances automatically when the AI finishes. Indicated by a circle border.

Hover a step number to see its type in the tooltip (e.g. "Step 3 (Checkpoint)").

Step type changes are undoable with `Ctrl+Z`. Setting a step to Autonomous shows a warning reminding you to verify your contexts are configured correctly.

## Running a Workflow

Place an item inside a workflow step, then right-click → **Run Workflow** (requires a terminal tab open). The item's content is sent to the terminal and the workflow begins executing.

What happens at each step depends on its type:

- **Autonomous** — Content is sent to the terminal. When the AI finishes, the item automatically advances to the next step and sends again.
- **Checkpoint** — Content is sent to the terminal. When the AI finishes, the workflow pauses and notifies you. Advance the item manually when ready.
- **Manual** — The item moves to the step but nothing is sent. The workflow pauses and waits for you to act.

Each step's content is sent with its applied contexts. If no context is applied, a default execute context is used.

A green flash and toast notification confirm each advancement. If the item reaches the final step and completes, the workflow ends and a completion toast appears.

Automated advancement bypasses the undo stack — you cannot undo an automated move with `Ctrl+Z`.

If the terminal fails to accept content, the workflow pauses automatically and shows an error. A 10-minute timeout warns you if a step takes longer than expected.

## Moving Items Manually

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
