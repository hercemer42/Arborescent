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

With decomposition enabled, the AI may produce one or more top-level items. If it returns multiple items, the original node is replaced by the new items as siblings at the same position. If it returns a single item, the original node is replaced in-place. Each result inherits the original node's blueprint and context metadata.

Decomposition works best when the applied context is a decomposition task — for example, a context that instructs the AI to break down a problem statement into user stories. The context tells the AI _what_ to decompose into; the decomposition flag tells Arborescent to accept multiple items back.

Decomposition works with all step types. On autonomous steps, the multiple nodes are created directly without the feedback panel. Undo (`Ctrl+Z`) restores the original node.

## Archiving

When feedback replaces a node, the original content is lost. To preserve it, configure **Archive input to** in the step configuration dialog. Set it to a destination node where originals should be collected.

When a step with archiving processes an item, the original node is moved to the top of the archive destination before the replacement is created. Both the archived original and each replacement get a collapsible child node containing hyperlinks to each other — click these to navigate between the source and its output.

Configure the link names in the step dialog to describe the relationship. For example, set the archive-side name to "Output" and the replacement-side name to "Source." These names become the titles of the collapsible link containers.

Enable **Resolve linked content when sending** if you want the AI to see the archived original's content alongside the replacement when the replacement is sent in a subsequent step. This is off by default — the links are navigational only.

If the archive destination has been deleted when a step tries to archive, the workflow pauses with a warning. Reconfigure the destination and run the step again.

The entire archive-and-replace operation is undoable with `Ctrl+Z`.

## Clear AI session

Enable **Clear AI session** in the step configuration dialog when you want the step to run against a fresh AI session — no context from prior turns. Useful for reducing accumulated context on long chains, isolating a step, or enforcing a predictable starting state.

Any unsent input you have typed in the target terminal is wiped when the reset fires. Don't enable it on terminals you are using for manual work.

Applies to Claude Code terminals only. Carries through blueprint export and import.

Requires the SessionStart hook — see [Hook Setup](#hook-setup).

## Recurse

When **decomposition** turns one item into many siblings — for example, a problem statement into five user stories — you typically want each of those items to continue through the remaining steps. Enable **Recurse** in the step configuration dialog to process them sequentially without manual intervention.

After a node completes a recurse-enabled step, the system finds the next waiting sibling under the decomposition step that produced this batch and starts it on the same terminal. Siblings are processed in order (first child first), repeating until every one has been handled.

Recurse only processes decomposed siblings. Set recurse on a workflow that has no decomposition step and nothing happens — a warning toast tells you to pair recurse with decomposition somewhere in the workflow. The step settings dialog flags the dependency in the description text under each option.

Stopping the workflow mid-recurse leaves all unprocessed siblings in their current steps. Nothing is lost. You can start them individually later or restart the workflow.

A safety limit of 50 sequential recurse iterations per terminal prevents runaway loops. If reached, recursion stops and a warning appears.

### Decomposition + Recurse

These two options work together. Enable decomposition on an earlier step to split one item into many, then enable recurse on a later step to process them all. Step 1 decomposes a problem into user stories, step 2 processes each user story through an implementation workflow — all automatically. Recurse without decomposition is a misconfiguration; decomposition without recurse just produces siblings you start manually.

If the workflow has multiple decomposition steps, each recurse step pairs with the nearest decomposition step earlier in the chain — pair each decomposition with its own downstream recurse to process every batch.

## Running a Workflow

Place an item inside an autonomous or checkpoint workflow step, then right-click → **Start Workflow** (requires a terminal tab open). The item's content is sent to the terminal and the workflow begins executing.

**Start Workflow** is not available on manual steps — use **Send** to send content to the terminal directly.

What happens at each step depends on its type:

- **Autonomous** — Content is sent to the terminal. When the AI finishes, the result is applied automatically and the item advances to the next step. With a Collaborate state the node content is replaced; with Collaborate & Execute the item statuses are updated; with Execute or Action no feedback is expected and the step advances on AI completion. If the feedback can't be parsed, or if the AI flags questions during the run, the workflow pauses — resume it manually.
- **Checkpoint** — Content is sent to the terminal. When the AI finishes, the feedback panel opens for you to review the result. Right-click → **Next step** to advance to the next step and resume execution there, or **Resend step** to send the current step again on the same terminal (use this when the AI paused with a question and you want to answer it in place). Advancing from the last step completes the workflow automatically.
- **Manual** — The item waits at the step. Nothing is sent automatically. Use **Send** to send content, then **Next step** to advance manually.

The **step's applied context** takes precedence over the working item's own context — that's how you steer the AI differently at each phase of the workflow. If the step has no applied context (and inherits none from the workflow chain), the working item's own context applies. If neither has a context, the branch's raw content is sent without scaffolding — apply **Basic execution** (Collaborate & Execute) to get the AI to make changes and update item statuses. Manual sends (right-click → **Send**) are unaffected by step contexts and always use the working item's own context.

A green flash and toast notification confirm each advancement. If the item reaches the final step and completes, the workflow ends and a completion toast appears.

Automated advancement bypasses the undo stack — you cannot undo an automated move with `Ctrl+Z`.

If the terminal fails to accept content, the workflow stops automatically and shows an error. A timeout (15 minutes by default) warns you if a step has no activity, with options to dismiss or stop the workflow.

While at least one autonomous workflow is running, Arborescent prevents the system from suspending so background AI work isn't interrupted by sleep. The block is released as soon as the last workflow finishes, errors, or is stopped. The display can still sleep — only system suspension is blocked.

For automated advancement to work, you need to configure your AI tool to send hook events back to Arborescent. See [Hook Setup](#hook-setup) below.

## Stopping and Continuing

You can stop a workflow at any time — running, or paused awaiting checkpoint validation: right-click → **Stop Workflow**. While running you can also press `Escape` on the selected node. The execution state is cleared — to run again, use **Start Workflow**.

A workflow also stops automatically when something disrupts the running item:

- You close the terminal tab the item is running in
- You move the item to a different step (drag, cut-paste, indent/outdent)
- You delete the step the item is at
- The application restarts while the item is running

A toast notification tells you what happened. Reordering the item within the same step (`Ctrl+Up`/`Ctrl+Down` among siblings) does not stop it.

Deleting a running item stops its workflow immediately and releases the terminal.

A paused checkpoint step (awaiting validation) offers two distinct actions. **Resend step** re-sends the current step on the same terminal without advancing — pick this when the AI asked you a question and you've edited the step content with your answer. **Next step** advances to the next workflow step and resumes execution there if that step is autonomous or checkpoint.

On app restart, all previously running items are stopped. Checkpoint items awaiting validation are preserved. Reopen a terminal and resend or advance them as needed.

Undoing a deletion (`Ctrl+Z`) restores the node but not its execution state — you need to start the workflow again.

## Resuming AI Sessions

Each workflow step that talks to an AI tool captures its session id on the node. Right-click a workflow node and pick **Resume session** to reattach — the action focuses the original terminal tab if it's still open, or opens a new one in the recorded working directory and runs `claude --resume`.

**Start Workflow** auto-resumes too. If the node already has a live session in an open tab, Start focuses that tab — no duplicate is created. If the tab was closed but the session is still on disk, Start opens a new tab and runs `claude --resume`. A fresh session only spawns when the node has no recorded session or its session has been lost. Stopping a workflow does not end its underlying CLI session, so the next Start picks up where you left off.

If the target terminal has no Claude session running yet, Start launches `claude` for you before sending the first prompt — no need to start it manually. The prompt is held back until the session is ready, so it lands inside the conversation rather than at the shell. Requires `claude` on your PATH; if it isn't, the step times out with the usual no-activity warning. The **Clear AI session** step option is skipped on this path since the new session is already clean — it still fires when reattaching to an existing session.

Closing a terminal tab no longer terminates the underlying session — the workflow execution stops, but the conversation remains in Claude's session store. You can walk away from a running step, close the tab, and resume from a fresh tab later. This works across app restart, as long as the session is still on disk.

If a session can't be resumed (gone from Claude's session store, or recorded directory removed), Resume session and the auto-resume on Start surface a toast at the moment of failure. Start the workflow again to spawn a fresh session.

## Recurse and AI Sessions

When **recurse** advances the chain to the next sibling, the new step stays inside the same Claude session as the previous one — your prior turns are still in context. No fresh session starts as long as the parent's session is alive.

If the parent's tab was closed, recurse opens a fresh tab in the recorded working directory and resumes the same session there before sending the next prompt. The whole chain rebinds to the new tab in one step; older siblings no longer point at the closed one.

If the parent session is gone (lost from Claude's session store), the next sibling starts in a fresh session and shows an amber dot — the **broken chain** indicator. The step itself runs normally; only the prior context is gone. The dot clears automatically once the chain is healed by a subsequent recurse advance into a live session.

## Running Multiple Items

You can run multiple items through the same workflow simultaneously — each in its own terminal tab. Each item advances independently based on the step types it encounters. Start each item with **Run Workflow** and select a different terminal tab for each one.

The active terminal's bound node is marked in the tree with a thin blue stripe on the left edge, so you can see at a glance which item the focused tab is driving. Focusing an item with a bound terminal tints that tab blue — so you can find its terminal even when another tab is active. Switching tabs moves the stripe; it never changes your selection.

## Moving Items Manually

Right-click an item inside a workflow step → **Next step** or **Previous step**. The item moves to the adjacent step. If the destination step is Autonomous or Checkpoint, the workflow starts automatically on a terminal — no need to right-click **Start Workflow** separately. Moving to a Manual step just moves the item without starting anything. Step numbers update automatically when you reorder, add, or remove steps.

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

Add three hooks to your Claude Code configuration (`~/.claude/settings.json`) that POST to Arborescent when a session starts, when a prompt is received, and when a session stops:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "command": "INPUT=$(cat); SOURCE=$(echo \"$INPUT\" | jq -r '.source // empty'); curl -s -X POST http://127.0.0.1:${ARBORESCENT_HOOK_PORT}/hook -H 'Authorization: Bearer '${ARBORESCENT_AUTH_TOKEN} -H 'Content-Type: application/json' -d \"{\\\"session_id\\\": \\\"${CLAUDE_SESSION_ID}\\\", \\\"hook_event_name\\\": \\\"SessionStart\\\", \\\"terminal_id\\\": \\\"${ARBORESCENT_TERMINAL_ID}\\\", \\\"source\\\": \\\"${SOURCE}\\\"}\""
      }
    ],
    "UserPromptSubmit": [
      {
        "command": "curl -s -X POST http://127.0.0.1:${ARBORESCENT_HOOK_PORT}/hook -H 'Authorization: Bearer '${ARBORESCENT_AUTH_TOKEN} -H 'Content-Type: application/json' -d '{\"session_id\": \"'${CLAUDE_SESSION_ID}'\", \"hook_event_name\": \"UserPromptSubmit\", \"terminal_id\": \"'${ARBORESCENT_TERMINAL_ID}'\"}'"
      }
    ],
    "Stop": [
      {
        "command": "curl -s -X POST http://127.0.0.1:${ARBORESCENT_HOOK_PORT}/hook -H 'Authorization: Bearer '${ARBORESCENT_AUTH_TOKEN} -H 'Content-Type: application/json' -d '{\"session_id\": \"'${CLAUDE_SESSION_ID}'\", \"hook_event_name\": \"Stop\", \"terminal_id\": \"'${ARBORESCENT_TERMINAL_ID}'\"}'"
      }
    ]
  }
}
```

The hook server binds to `127.0.0.1` only — it is not accessible from the network. The auth token is regenerated each time Arborescent starts.

Each hook plays a distinct role:

- **SessionStart** — maps the Claude session to its terminal so subsequent events can be routed correctly, and enables the Clear AI session step option. Requires `jq` to be installed.
- **UserPromptSubmit** — acknowledges that an injected workflow prompt reached Claude. Without it, Arborescent cannot tell whether a prompt was delivered and will retry up to three times before stopping the step with a delivery-failed error.
- **Stop** — signals that Claude finished processing, so the workflow can advance to the next step.

Stop fires when Claude returns to its prompt. If Claude backgrounds a long-running command (`yarn test &`, watch loops) and idles while polling it, Stop fires before the work is done and the workflow advances early. Autonomous-terminal prompts include a directive telling Claude to run checks inline rather than backgrounding them — but this is best-effort: if a step advances faster than expected, check whether its work was backgrounded.

If any of these are missing, workflows may start but will not behave correctly. A setup guide appears the first time you run a workflow if no hook events have been received. Once hooks are working, the guide won't appear again.

## Dragging Workflows

Drag a workflow into any blueprint node. Drops into non-blueprint nodes, workflow steps, and contexts are rejected with an error message.
