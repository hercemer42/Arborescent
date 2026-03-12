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

If the terminal fails to accept content, the workflow pauses automatically and shows an error. A timeout (10 minutes by default) warns you if a step has no activity, with options to dismiss or pause the workflow.

For automated advancement to work, you need to configure your AI tool to send hook events back to Arborescent. See [Hook Setup](#hook-setup) below.

## Pausing and Resuming

A workflow pauses automatically when something disrupts the running item:

- You close the terminal tab the item is running in
- You move the item to a different step (drag, cut-paste, indent/outdent)
- You delete the step the item is at
- The application restarts while the item is running

A toast notification tells you what happened. Reordering the item within the same step (`Ctrl+Up`/`Ctrl+Down` among siblings) does not pause it.

Deleting a running item stops its workflow immediately and releases the terminal — there is nothing to resume.

To resume a paused item, right-click it → **Resume Workflow**. It picks up from wherever it currently sits. If you moved the item before resuming, it continues from the new position.

On app restart, all previously running items appear as paused. Reopen a terminal and resume them individually.

Undoing a deletion (`Ctrl+Z`) restores the node but not its execution state — you need to start the workflow again.

## Running Multiple Items

You can run multiple items through the same workflow simultaneously — each in its own terminal tab. Each item advances independently based on the step types it encounters. Start each item with **Run Workflow** and select a different terminal tab for each one.

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

## Hook Setup

Workflow automation requires your AI tool to notify Arborescent when it finishes processing. Arborescent runs a local HTTP server that receives these notifications.

When you open a terminal tab, Arborescent injects three environment variables:

- `ARBORESCENT_HOOK_PORT` — the port the hook server is listening on
- `ARBORESCENT_AUTH_TOKEN` — a per-session auth token
- `ARBORESCENT_TERMINAL_ID` — the terminal tab's unique ID

### Claude Code

Add a hook to your Claude Code configuration (`~/.claude/hooks.json`) that POSTs to Arborescent when a session starts and stops:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "stop",
        "command": "curl -s -X POST http://127.0.0.1:${ARBORESCENT_HOOK_PORT}/hook -H 'Authorization: Bearer '${ARBORESCENT_AUTH_TOKEN} -H 'Content-Type: application/json' -d '{\"session_id\": \"'${CLAUDE_SESSION_ID}'\", \"hook_event_name\": \"Stop\", \"terminal_id\": \"'${ARBORESCENT_TERMINAL_ID}'\"}'"
      }
    ],
    "SessionStart": [
      {
        "command": "curl -s -X POST http://127.0.0.1:${ARBORESCENT_HOOK_PORT}/hook -H 'Authorization: Bearer '${ARBORESCENT_AUTH_TOKEN} -H 'Content-Type: application/json' -d '{\"session_id\": \"'${CLAUDE_SESSION_ID}'\", \"hook_event_name\": \"SessionStart\", \"terminal_id\": \"'${ARBORESCENT_TERMINAL_ID}'\"}'"
      }
    ]
  }
}
```

The hook server binds to `127.0.0.1` only — it is not accessible from the network. The auth token is regenerated each time Arborescent starts.

If the hook is not configured, workflows will start but never advance automatically. A setup guide appears the first time you run a workflow if no hook events have been received. Once hooks are working, the guide won't appear again.

## Dragging Workflows

Drag a workflow into any blueprint node. Drops into non-blueprint nodes, workflow steps, and contexts are rejected with an error message.
