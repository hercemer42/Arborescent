# The standard prompt forbids summary nodes nobody asked for

## 📄 Product spec

### Context

An AI working a step writes to the tree in one of two ways: headings in the list it submits, or `add_child_node` calls on a both-mode step.
Both paths are open, and models reliably use them to deposit an account of their own work — a "Summary" node, a decision record, a notes node, a recap of what was verified — beside the items the step actually asked for.

Every such node is permanent tree content that the user then has to read, judge and delete, and it dilutes the subtree a later step is bound to.

The rule against it currently exists only in the developer's personal instruction file, outside this repository.
That placement is also the wrong altitude: a personal instruction has to compete with the step prompt, and the step prompt contains instructions that read like a licence to add nodes — the heading-persistence rules tell the model to capture values as child nodes, and the default execute context tells it to record issues as child nodes.
When a generic "capture it as a child node" line and a personal "never add summary nodes" line disagree, the prompt wins, so the prohibition has to live in the prompt as the qualifier on those lines.

### Goal

Ship the prohibition in the standard prompt, scoped to the kind of node rather than to node creation, so that it holds for every send path and for any user.

### Business rules

1. Every prompt Arborescent sends carries a rule forbidding nodes whose content is commentary about the work rather than the work itself.
2. The forbidden kinds are named explicitly — summary, recap, decision record, notes, history or changelog, and "what I did" nodes — because an unnamed category is read as advice.
3. The rule is scoped by kind, not by quantity, so adding nodes remains permitted wherever the step's content calls for them.
4. The rule yields to an explicit instruction in the step: a step that asks for issues as child nodes, or for a value preserved as a child node, still gets those nodes.
5. A generic instruction to capture values as child nodes is not such an explicit ask, and the rule says so.
6. The rule names the terminal output as where an unrequested observation goes, so the model has a destination rather than only a prohibition.
7. When a step says no action is needed, the content is submitted unchanged rather than annotated.
8. The rule is stated once, in the instruction block every send path shares, rather than repeated per path.
9. The rule costs one line of prompt, since every send pays for it in tokens.

### Acceptance criteria

#### Happy path

- [ ] A collaborate step's prompt contains the rule.
- [ ] A collaborate+execute step's prompt contains the rule, even though that path carries no output-format block.
- [ ] An execute-only step's prompt contains the rule.
- [ ] A decomposition step's prompt contains the rule.
- [ ] A prompt sent to the browser contains the rule, in the same wording as the terminal one.
- [ ] The rule names the terminal as the destination for anything worth saying that no step asked for.

#### Edge cases

- [ ] The rule appears once in a prompt, not once per instruction section.
- [ ] A step that asks for issues to be recorded as child nodes still produces them, and the rule text does not contradict that instruction.
- [ ] A step that asks for a value to be preserved as a child node still produces it.
- [ ] A code-node execution prompt, which is built from the shared block without any workflow scaffolding, carries the rule too.
- [ ] A step whose content needs no change is submitted unchanged, with no node added to explain that nothing changed.

#### Non-functional

- [ ] No new labelled section is added to the prompt; the change is one line inside the existing rules block.

---

## 🔧 Implementation proposal

### Approach

Add the rule as a single line in `BASE_INSTRUCTION_RULES` in the prompt builder.

That block is the only one every path interpolates.
The output-format blocks are the intuitive home and the wrong one: collaborate+execute prompts are built with the output format suppressed, so a rule placed there would miss the one mode that writes to the tree through MCP tools.

Restate the rule in the `add_child_node` tool description as well, so it reaches the model at the moment of the write rather than only at the top of a long prompt.

### Touchpoints

- **`src/renderer/utils/promptBuilder.ts`** — `BASE_INSTRUCTION_RULES`, shared by the structured-prompt builder and by both instruction builders in the send actions.
- **`src/renderer/store/tree/actions/sendActions.ts`** — no change expected; confirm the collaborate, execute and decomposition builders all inherit the block.
- **`src/main/services/mcpServer.ts`** — the `add_child_node` tool description, as a second statement of the rule at the write site.
- **Prompt-content tests** — `sendActionsBothModePrompt.test.ts` and `collaboratePromptNodeAdditions.test.ts` are where prompt text is already asserted.

### Constraints to call out

- `BASE_INSTRUCTION_RULES` is shared prompt scaffolding: a wording change lands on every send at once, including browser sends and code-node execution.
- The wording has to qualify the heading-persistence and issue-recording instructions rather than appear to cancel them, since those instructions are also in the prompt and the model has to resolve the two together.
- The rule is advisory by construction, and that is accepted: there is no deterministic backstop and none should be built.
- **Gating `add_child_node` server-side by node kind is rejected** — the server cannot tell a summary node from an authored one, and the collaborate path writes through the submitted list rather than through the tool, so the gate would miss the more common case while blocking legitimate writes.

### Out of scope

Cleaning up summary nodes already in the tree; a tree lint that flags them after the fact; the routing rules for the Findings node.

### Implementation notes

Once a submitted list is parsed, a summary heading is indistinguishable from an authored item, so there is nothing to filter after the fact — the prompt is the only point at which this is preventable.
