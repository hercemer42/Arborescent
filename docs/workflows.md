# Workflows

Organize sequential steps by declaring a blueprint branch as a workflow.

## Declaring a Workflow

Right-click a blueprint branch → **Blueprint** → **Declare as Workflow**. The branch shows a play icon and its children become numbered steps. Children that aren't already blueprints are automatically added.

The parent must be a blueprint. Contexts and their descendants cannot be workflows.

To remove: right-click → **Workflow** → **Remove from Workflow** (also available under **Blueprint**). Both actions are undoable with `Ctrl+Z`.

## Step Types

Each workflow step has a type that controls how it will be handled during workflow execution. Click a step number to open the step configuration dialog and change its type. You can also right-click a step → **Workflow** → **Configure Step**.

- **Manual** (default) — The item waits at the step for you to act. Nothing is sent to the terminal. Indicated by a square border around the step number.
- **Checkpoint** — Content is sent to the terminal. When the AI finishes, the workflow awaits your validation before continuing. Indicated by a triangle border.
- **Autonomous** — Content is sent and the item advances automatically when the AI finishes. Indicated by a circle border.

Hover a step number to see its type in the tooltip (e.g. "Step 3 (Checkpoint)").

Step type changes are undoable with `Ctrl+Z`. Setting a step to Autonomous shows a warning reminding you to verify your contexts are configured correctly.

## Decomposition

By default, collaborating on a node replaces it with a single updated version. Enable **Decomposition** in the step configuration dialog to break a node into multiple sibling nodes instead — for example, turning a problem statement into separate user stories.

With decomposition enabled, the AI is instructed to produce multiple top-level items. When you accept the feedback, the original node is replaced by the new items as siblings at the same position. Each sibling inherits the original node's blueprint and context metadata.

Decomposition works best when the applied context is a decomposition task — for example, a context that instructs the AI to break down a problem statement into user stories. The context tells the AI _what_ to decompose into; the decomposition flag tells Arborescent to expect multiple items back.

Decomposition works with all step types. On autonomous steps, the multiple nodes are created directly without the feedback panel. Undo (`Ctrl+Z`) restores the original node.

## Archiving

When feedback replaces a node, the original content is lost. To preserve it, configure **Archive input to** in the step configuration dialog. Set it to a destination node where originals should be collected.

When a step with archiving processes an item, the original node is moved to the top of the archive destination before the replacement is created. Both the archived original and each replacement get a collapsible child node containing hyperlinks to each other — click these to navigate between the source and its output.

Configure the link names in the step dialog to describe the relationship. For example, set the archive-side name to "Output" and the replacement-side name to "Source." These names become the titles of the collapsible link containers.

Enable **Resolve linked content when sending** if you want the AI to see the archived original's content alongside the replacement when the replacement is sent in a subsequent step. This is off by default — the links are navigational only.

If the archive destination has been deleted when a step tries to archive, the workflow pauses with a warning. Reconfigure the destination and run the step again.

The entire archive-and-replace operation is undoable with `Ctrl+Z`.

## Recurse

When a step produces multiple items — for example, decomposition turns one problem statement into five user stories — you typically want each of those items to continue through the remaining steps. Enable **Recurse** in the step configuration dialog to process them sequentially without manual intervention.

When a node advances past or completes a recurse-enabled step, the system looks back through the autonomous step chain to find the first autonomous step, then picks up the next waiting item there and starts it on the same terminal. Items are processed in order (first child first). This repeats until no waiting items remain.

Recurse only walks back through contiguous autonomous steps. If the chain hits a checkpoint or manual step, recursion stops there — you continue manually at that point.

Stopping the workflow mid-recurse leaves all unprocessed items in their current steps. Nothing is lost. You can start them individually later or re-enable recurse and start again.

A safety limit of 50 sequential recurse iterations per terminal prevents runaway loops. If reached, recursion stops and a warning appears.

### Decomposition + Recurse

These two options combine naturally. Enable decomposition on an earlier step to break one item into many, then enable recurse on a later step to process them all sequentially. For example: step 1 decomposes a problem into user stories, step 2 processes each user story through an implementation workflow — all automatically.

## Running a Workflow

Place an item inside an autonomous workflow step, then right-click → **Start Workflow** (requires a terminal tab open). The item's content is sent to the terminal and the workflow begins executing through the autonomous chain.

**Start Workflow** is only available on autonomous steps — for manual and checkpoint steps, use **Send** to send content to the terminal directly.

What happens at each step depends on its type:

- **Autonomous** — Content is sent to the terminal. When the AI finishes, the item automatically advances to the next step and sends again. If the step uses a collaborate-mode context, the AI's feedback is accepted automatically — the node is replaced and the workflow continues without opening the feedback panel. If the feedback can't be parsed, the workflow pauses with an error.
- **Checkpoint** — Content is sent to the terminal. When the AI finishes, the item awaits your validation. If the step uses a collaborate-mode context, feedback appears in the panel for review. Right-click → **Continue Workflow** to advance it to the next step and resume.
- **Manual** — The item waits at the step. Nothing is sent automatically. Use **Send** to send content, then **Next step** to advance manually.

Each step's content is sent with its applied contexts. If no context is applied, a default execute context is used.

A green flash and toast notification confirm each advancement. If the item reaches the final step and completes, the workflow ends and a completion toast appears.

Automated advancement bypasses the undo stack — you cannot undo an automated move with `Ctrl+Z`.

If the terminal fails to accept content, the workflow stops automatically and shows an error. A timeout (15 minutes by default) warns you if a step has no activity, with options to dismiss or stop the workflow.

For automated advancement to work, you need to configure your AI tool to send hook events back to Arborescent. See [Hook Setup](#hook-setup) below.

## Stopping and Continuing

You can stop a running workflow at any time: right-click → **Stop Workflow**, or press `Escape` while the running node is selected. The execution state is cleared — to run again, use **Start Workflow**.

A workflow also stops automatically when something disrupts the running item:

- You close the terminal tab the item is running in
- You move the item to a different step (drag, cut-paste, indent/outdent)
- You delete the step the item is at
- The application restarts while the item is running

A toast notification tells you what happened. Reordering the item within the same step (`Ctrl+Up`/`Ctrl+Down` among siblings) does not stop it.

Deleting a running item stops its workflow immediately and releases the terminal.

**Continue Workflow** is only available for checkpoint steps that have finished — it advances the item to the next step and resumes execution if that step is autonomous or checkpoint.

On app restart, all previously running items are stopped. Checkpoint items awaiting validation are preserved. Reopen a terminal and start or continue them as needed.

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
