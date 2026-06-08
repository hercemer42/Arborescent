# Workflows

> **Prerequisite:** automated workflows require **Claude Code**. Hook-driven step advancement, the MCP tree tools, **Clear AI session**, and session resume all run through Claude Code and its hooks (see [Hook Setup](#hook-setup)). Basic send, contexts, and inline review work with any terminal or browser AI — see [Core Workflow](workflow.md).

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

Decomposition works with all step types. On autonomous steps, the multiple nodes are created directly without a review step; on checkpoint or manual steps the proposed branches appear inline for you to accept or cancel first. Undo (`Ctrl+Z`) restores the original node.

## Clear AI session

Enable **Clear AI session** in the step configuration dialog when you want the step to run against a fresh AI session — no context from prior turns. Useful for reducing accumulated context on long chains, isolating a step, or enforcing a predictable starting state.

Any unsent input you have typed in the target terminal is wiped when the reset fires. Don't enable it on terminals you are using for manual work.

Applies to Claude Code terminals only. Carries through blueprint export and import.

Requires the SessionStart hook — see [Hook Setup](#hook-setup).

## Recurse

When **decomposition** turns one item into many siblings — for example, a problem statement into five user stories — you typically want each of those items to continue through the remaining steps. Enable **Recurse** in the step configuration dialog to process them sequentially without manual intervention.

After a node completes a recurse-enabled step, the system finds the next waiting sibling under the decomposition step that produced this batch and starts it on the same terminal. Siblings are processed in order (first child first), repeating until every one has been handled. Each sibling pauses at the recurse step after its pass, so the batch collects there while the rest are processed.

Recurse only pauses items that have decomposition siblings to coordinate. An item that was never decomposed passes through an automated recurse step like any other step. Set recurse on a workflow that has no decomposition step and nothing happens — a warning toast tells you to pair recurse with decomposition somewhere in the workflow. The step settings dialog flags the dependency in the description text under each option.

Stopping the workflow mid-recurse leaves all unprocessed siblings in their current steps. Nothing is lost. You can start them individually later or restart the workflow.

A safety limit of 50 sequential recurse iterations per terminal prevents runaway loops. If reached, recursion stops and a warning appears.

### Decomposition + Recurse

These two options work together. Enable decomposition on an earlier step to split one item into many, then enable recurse on a later step to process them all. Step 1 decomposes a problem into user stories, step 2 processes each user story through an implementation workflow — all automatically. Recurse without decomposition is a misconfiguration; decomposition without recurse just produces siblings you start manually.

If the workflow has multiple decomposition steps, each recurse step pairs with the nearest decomposition step earlier in the chain — pair each decomposition with its own downstream recurse to process every batch.

## Running a Workflow

Place an item inside any workflow step, then right-click → **Start Workflow** (requires a terminal tab open). The item's content is sent to the terminal and the workflow begins executing.

What happens at each step depends on its type:

- **Autonomous** — Content is sent to the terminal. When the AI finishes, the result is applied automatically and the item advances to the next step. With a Collaborate state the node content is replaced; with Collaborate & Execute the item statuses are updated; with Execute or Action no feedback is expected and the step advances on AI completion. If the feedback can't be parsed, or if the AI flags questions during the run, the workflow pauses — resume it manually.
- **Checkpoint** — Content is sent to the terminal. When the AI finishes, the result opens for you to review inline on the step's node — a decomposition into several nodes shows the proposed branches inline in place. Right-click → **Next step** to advance to the next step and resume execution there, or **Resend step** to send the current step again on the same terminal (use this when the AI paused with a question and you want to answer it in place). Advancing from the last step completes the workflow automatically.
- **Manual** — Content is sent to the terminal and the workflow pauses at the step regardless of how the AI finishes — the same paused state checkpoint uses — unless it's the last step, which completes the workflow and frees the terminal instead of pausing. Right-click → **Resume Workflow** re-sends the step on the same bound terminal; **Next step** advances. Ad-hoc **Send** still works for one-off relays that don't enter the paused state.

The **step's applied context** takes precedence over the working item's own context — that's how you steer the AI differently at each phase of the workflow. If the step has no applied context (and inherits none from the workflow chain), the working item's own context applies. If neither has a context, the branch's raw content is sent without scaffolding — apply **Basic execution** (Collaborate & Execute) to get the AI to make changes and update item statuses. Manual sends (right-click → **Send**) are unaffected by step contexts and always use the working item's own context.

A green flash confirms each advancement, and the transition is recorded in the [activity log](#activity-log) in the status bar rather than popping a toast. If the item reaches the final step and completes, the workflow ends and a completion toast appears.

Automated advancement bypasses the undo stack — `Ctrl+Z` only reverts your own actions, never workflow output. Prior workflow output stays recoverable through each step's history (see [Step History](#step-history)).

If the terminal fails to accept content, the workflow stops automatically and shows an error. A step that hangs (the AI session died, the Stop hook never lands, the command runs forever) stays in the running state until you stop it — right-click the node and pick **Stop Workflow**.

While at least one autonomous workflow is running, Arborescent prevents the system from suspending so background AI work isn't interrupted by sleep. The block is released as soon as the last workflow finishes, errors, or is stopped. The display can still sleep — only system suspension is blocked.

For automated advancement to work, you need to configure Claude Code to send hook events back to Arborescent. See [Hook Setup](#hook-setup) below.

## Stopping and Continuing

You can stop a workflow at any time — running, or paused awaiting checkpoint validation: right-click → **Stop Workflow**. While running you can also press `Escape` on the selected node. The execution state is cleared — to run again, use **Start Workflow**.

A workflow also stops automatically when something disrupts the running item:

- You close the terminal tab the item is running in
- You move the item to a different step (drag, cut-paste, indent/outdent)
- You delete the step the item is at
- The application restarts while the item is running

A toast notification tells you what happened. Reordering the item within the same step (`Ctrl+Up`/`Ctrl+Down` among siblings) does not stop it.

Deleting a running item stops its workflow immediately and releases the terminal.

A paused step (awaiting validation) shows an amber pause glyph in its gutter and offers three actions:

- **Unpause** — click the pause glyph to flip the step back to play. Nothing is re-sent and the step doesn't advance yet; when the current prompt finishes, the workflow advances on its own. Use this when the AI paused to ask a question, you answered it directly in the terminal, and you want the step to finish and carry on — answer once and walk away instead of waiting to click anything at the end. This only carries a step forward where completion already advances it (an autonomous step); a manual or checkpoint step re-pauses at the end for your validation by design, so use **Next step** to move those on.
- **Resend step** — right-click to re-send the current step on the same terminal without advancing. Pick this when you answered by editing the step content instead. On a manual step this action is labelled **Resume Workflow**.
- **Next step** — right-click to advance to the next workflow step and resume execution there if that step is autonomous or checkpoint.

When an autonomous step pauses because the AI judged the task had outgrown the reasoning effort it was started with, the fix isn't in the content: raise Claude Code's reasoning effort (or switch to a more capable model), then **Resend step**.

On app restart, all previously running items are stopped. Checkpoint items awaiting validation are preserved. Reopen a terminal and resend or advance them as needed.

A step the AI had already finished — but that hadn't advanced yet when the restart hit — now recovers on its own: it advances once the AI's completion registers, so a finished step no longer stalls silently across a restart. If it genuinely can't continue (for example its terminal was closed), a persistent notice flags the step and selects it rather than dropping quietly.

Undoing a deletion (`Ctrl+Z`) restores the node but not its execution state — you need to start the workflow again.

## Step History

Each workflow step keeps the last 10 changes it made as a browsable history attached to the step itself. `Ctrl+Z` reverts only your own actions; workflow output stays in step history instead of the undo stack, so a workflow run can never erase a manual edit you wanted to undo.

To browse: right-click a workflow step → **Step History**. Each entry is labeled with the captured node's own title, so successive captures stay easy to tell apart; hover an entry to see when it was captured. The item is disabled with "No history yet" until the step has run at least once.

To restore: click an entry. A deep copy of the captured subtree appears as a child of the step alongside the current node. The current node and its terminal session are unchanged — restoration is non-destructive. Press `Ctrl+Z` to remove the restored copy cleanly. Restoring the same entry twice produces two independent copies; the history list itself is never modified by restoration.

The history covers what passed through that step: the workflow's starting step captures the input node's pre-workflow state; each step that mutates an owned node captures the pre-mutation state; checkpoint accepts capture the pre-accept state; decomposition captures both the pre-decomposition parent and the initial state of each new sibling. Automated moves between steps aren't recorded — they aren't changes to recover.

Each step holds up to 10 entries; the 11th change evicts the oldest. Deleting a step keeps its history attached, so undoing the deletion brings the history back intact. Existing `.arbo` files without history open normally and start collecting entries on their next workflow run.

## Resuming AI Sessions

Each workflow step that talks to an AI tool captures its session id on the node. When the session's original terminal tab has been closed, right-click the workflow node and pick **Resume session** to open a new tab in the recorded working directory and reattach via `claude --resume`. While the original tab is still open, **Resume session** doesn't appear — just switch to that tab.

**Start Workflow** auto-resumes too. If the node already has a live session in an open tab, Start focuses that tab — no duplicate is created. If the tab was closed but the session is still on disk, Start opens a new tab and runs `claude --resume`. A fresh session only spawns when the node has no recorded session or its session has been lost. Stopping a workflow does not end its underlying CLI session, so the next Start picks up where you left off.

If you Start a workflow on a terminal whose live session belongs to a different node, Arborescent asks first: a dialog names the current node and the one you're switching to, and nothing happens until you choose. **Rebind** hands the terminal to the new node — renaming the tab and sending the prompt; **Keep current** leaves the existing binding, tab title, and session untouched. The prompt only appears when a Start would take over a terminal bound to another node — resuming a node onto its own session, and decomposition hand-offs during recurse, switch silently.

If the target terminal has no Claude session running yet, Start launches `claude` for you before sending the first prompt — no need to start it manually. The prompt is held back until the session is ready, so it lands inside the conversation rather than at the shell. Requires `claude` on your PATH; if it isn't, the prompt lands at the shell and the step won't advance — stop it manually from the right-click menu. The **Clear AI session** step option is skipped on this path since the new session is already clean — it still fires when reattaching to an existing session.

Closing a terminal tab no longer terminates the underlying session — the workflow execution stops, but the conversation remains in Claude's session store. You can walk away from a running step, close the tab, and resume from a fresh tab later. This works across app restart, as long as the session is still on disk.

If a session can't be resumed (gone from Claude's session store, or recorded directory removed), Resume session and the auto-resume on Start surface a toast at the moment of failure. Start the workflow again to spawn a fresh session.

## Recurse and AI Sessions

When **recurse** advances the chain to the next sibling, the new step stays inside the same Claude session as the previous one — your prior turns are still in context. No fresh session starts as long as the parent's session is alive.

If the parent's tab was closed, recurse opens a fresh tab in the recorded working directory and resumes the same session there before sending the next prompt. The whole chain rebinds to the new tab in one step; older siblings no longer point at the closed one.

If the parent session is gone (lost from Claude's session store), the next sibling starts in a fresh session and a toast tells you the chain was broken. The affected node also shows a red unlink icon beside its status — hover it for the reason — and the icon clears as soon as a new session binds to the node. The step itself runs normally; only the prior context is gone.

## Running Multiple Items

You can run multiple items through the same workflow simultaneously — each in its own terminal tab. Each item advances independently based on the step types it encounters. Start each item with **Run Workflow** and select a different terminal tab for each one.

The active terminal's bound node is marked in the tree with a thin blue stripe on the left edge, so you can see at a glance which item the focused tab is driving. Focusing an item with a bound terminal tints that tab blue — so you can find its terminal even when another tab is active. Switching tabs moves the stripe; it never changes your selection.

## Moving Items Manually

Right-click an item inside a workflow step → **Next step** or **Previous step**. The item moves to the adjacent step. If the destination step is Autonomous or Checkpoint, the workflow starts automatically on a terminal — no need to right-click **Start Workflow** separately. Moving to a Manual step just moves the item without starting anything. Step numbers update automatically when you reorder, add, or remove steps.

## Sending Items to a Workflow

Right-click any branch → **Send to workflow** → pick a destination. The branch and its subtree move under the destination workflow's first step, the view jumps there, and the branch flashes on arrival.

The submenu lists every workflow in the current file, alphabetically. The workflow the branch already lives in is included — pick it to relocate the branch under that workflow's first step. Workflows inside the branch's own subtree (or the branch itself, if it's a workflow) are excluded to prevent cycles.

Attached contexts on the branch and its descendants survive the move. Undoable with `Ctrl+Z`.

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

Workflow automation requires Claude Code to notify Arborescent when it finishes processing. Arborescent runs a local HTTP server that receives these notifications.

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

## Activity log

Workflow step transitions — advancing, waiting at a manual step, auto-accepting feedback — no longer pop a toast. They are recorded in the activity log at the right of the status bar: the most recent transition shows inline, hovering it reveals the last five, and clicking opens a panel with the last hundred — click it again to close the panel. Hover any entry, in the preview or the panel, to read its full message. An unread count sits next to it while transitions you haven't opened arrive. The log persists across restarts and keeps the most recent entries.

Toasts stay reserved for what needs you — review requests, errors, and workflow completion still pop as before.

## Diagnostic log

When a workflow stalls or a step doesn't advance the way you expected, open the diagnostic log to see what Arborescent received and how it routed each event. Use **Help → Open Log File** in the menu.

Each line is tagged with the workflow node it concerns when one was resolvable, so you can follow a single node's lifecycle with `grep node=<node-id>`. Dropped hooks are tagged with a reason — `no terminal mapped`, `no running node`, `invalid auth token`, or `invalid payload body` — so you can tell apart a hook that never arrived from one that arrived and was discarded.

When Claude calls an MCP tool but Arborescent can't resolve the node its session is bound to, the tool reply names the actual cause — the renderer wasn't ready yet, no open file owns the session, or the bound node is no longer in its file (deleted, or the file was closed). Claude reads the reply and reacts on its own; the same cause is logged as `tree-read failure kind=<cause>` with the session and node ids for when you're reconstructing what happened.

Every refused or failed MCP tool call also carries a stable error code (`write/unbound`, `write/mode-refusal`, `write/target-drift`, and so on) alongside the human-readable reply, and when the failure is logged the line carries the identical string as `code=<code>`. When you're tracing why an agent's call was refused, grep the log for the code the agent reported — a line that matches is the exact refusal it saw.

The log is appended to across sessions and rotates at 5 MB, keeping the three previous files (`arborescent.log.1` through `.3`). Attach the file to bug reports.

## Dragging Workflows

Drag a workflow into any blueprint node. Drops into non-blueprint nodes, workflow steps, and contexts are rejected with an error message.
