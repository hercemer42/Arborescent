# Story file links with a rendered preview

## 📄 Product spec

### Context

User stories are moving out of Arborescent nodes and into markdown files in this repository.
The node format required one node per business rule and one per acceptance criterion, which broke prose into heading-shaped fragments and made tables and fenced code inexpressible.
Files fix that, and add something nodes cannot offer: the story travels with the branch, so a spec edit lands in the PR diff and is reviewed like code.

The user is the sole developer, reading a story back while orchestrating the work it describes.

What files cost is proximity.
The story becomes a path that has to be opened somewhere else, in the middle of driving a workflow displayed in Arborescent — and reading raw markdown every time is tiring in a way that compounds over a working day.

### Goal

Let a node point at a markdown file in the project and open it rendered in the existing browser tab, so a story authored outside Arborescent can be read inside it without a context switch.

### Business rules

1. A node may carry a link to a markdown file in the project, stored as `isFileLink` plus a `filePath` in metadata, where the path is relative to the directory containing the open `.arbo` file.
2. The path is stored relative rather than absolute so a story link survives being committed, cloned to another machine, and pasted between `.arbo` files in the same repository.
3. A file link is created from the node context menu via a native file picker; the chosen path is relativised on the way in, and a file resolving outside the `.arbo` file's directory tree is refused with a stated reason.
4. A file link is a child of the story node, never the story node itself, because link nodes cannot be workflow subjects: the status area's link branch renders no checkbox, no workflow overlay and no step number, the status submenu skips links, and the context menu withholds the workflow, blueprint and send-to-workflow entries for them.
5. The story node therefore stays an ordinary node carrying the title and the orchestration state, and the file link is an attachment beneath it.
6. The node context menu offers Preview on a file link, which renders the file and opens it in the existing browser tab.
7. Preview renders the subset of markdown a story uses: headings, ordered and unordered lists, task lists, tables, inline and fenced code, emphasis, blockquotes and links, with task-list checkboxes read-only.
8. The generated HTML is sanitised even though it lands in a sandboxed webview, because on a public repository a story file can arrive through a pull request from someone else.
9. Preview writes a temporary HTML file, replaces it on re-preview of the same file, and removes it when the browser tab closes and on quit.
10. A relative markdown link inside a preview opens that file's preview; an external URL navigates in the browser tab as it does today.
11. A preview is a snapshot taken when it is opened; there is no filesystem watcher, so a file edited afterwards shows the previous content until previewed again.
12. If the file is missing or unreadable, the link renders as broken and Preview refuses with the path it could not read, rather than opening an empty tab.
13. When a workflow step's subject node has a file-link child, the step prompt carries that file's path so the session reads it with its own tools; the prompt never inlines the file's contents.
14. Arborescent neither creates, renames nor deletes story files.

### Acceptance criteria

#### Happy path

- [ ] The node context menu offers a file-link action, and choosing a markdown file creates a child node carrying `isFileLink` and a relative `filePath`.
- [ ] Preview on that child opens the browser tab with the file rendered.
- [ ] A story containing headings, a numbered list, a task list, a table and a fenced code block renders all five correctly.
- [ ] A workflow step whose subject has a file-link child produces a prompt containing the file's path and not its contents.
- [ ] A relative markdown link inside a preview opens that file's preview.
- [ ] An external URL inside a preview navigates the browser tab.

#### Edge cases

- [ ] A file deleted after linking renders the link as broken, and Preview refuses naming the path.
- [ ] A file picked outside the `.arbo` file's directory tree is refused with a stated reason and no node is created.
- [ ] A file link pasted into another `.arbo` file in the same repository still resolves; pasted into a file elsewhere it renders as broken rather than reading an unrelated file.
- [ ] A story file containing a script tag or an inline event handler renders as text and executes nothing.
- [ ] A file that is not markdown is refused at pick time.
- [ ] An empty file previews as an empty document rather than an error.
- [ ] The story node keeps its checkbox, step number and workflow overlay while its file-link child renders as a link.
- [ ] Editing the file on disk leaves an open preview showing the previous content, and re-previewing shows the new content.
- [ ] Closing the browser tab removes the temporary file; quitting with a preview open removes it too.

#### Non-functional

- [ ] A 500-line story previews without visible delay.
- [ ] Preview adds no dependency beyond the markdown-to-HTML converter agreed for this story.

---

## 🔧 Implementation proposal

### Approach

Two pieces: a link kind and a preview action.

The link kind is a variant of the existing link node.
`isHyperlink` targets a node id and `isExternalLink` targets a URL; `isFileLink` targets a repo-relative path.
It reuses the status area's link branch, the link's context-menu shape, and the hyperlink navigation hook's dispatch.

Preview converts the file to HTML, writes it to the existing temp directory, and hands the path to the browser panel, which is a real Electron webview (`webviewTag: true`) and will load it.
Reading the file needs no new IPC — a `readFile` channel exists — but its handler must apply the existing path-traversal guard, resolving the candidate against the `.arbo` file's directory and rejecting anything that escapes it.

Step prompts need only the path, so the send path resolves a subject node's file-link child and adds one line.
No content resolution, no size limit, no truncation.

### Touchpoints

- **Shared types** — `isFileLink` and `filePath` on node metadata.
- **Node content** — the file-link case in the link branch and in the hyperlink navigation hook's dispatch, plus a broken-link presentation when the path does not resolve.
- **Context menu** — a file-link action opening the native file picker with relativisation and the outside-the-tree refusal, and a Preview action on an existing file link.
- **Markdown to HTML** — a new dependency, plus sanitisation of its output.
- **Temp files** — preview file naming, replacement and removal, on top of the existing temp directory handlers.
- **Main process** — the traversal guard applied to the file read, resolved against the `.arbo` file's directory.
- **Send path** — one prompt line carrying a subject node's file-link path.
- **Tests** — relativisation and refusal at pick time, each supported markdown construct, script-tag inertness, broken-path refusal, temp-file cleanup, prompt line presence, and the subject node keeping its own semantics with a file-link child.

### Constraints to call out

- This story cannot ship without a new dependency. Nothing in the project converts markdown to HTML; the existing rich-content rendering hand-rolls inline URLs and backtick code only, and hand-rolling tables and fenced code would be no cheaper and worse on sanitisation.
- Link nodes cannot be workflow subjects, which is why the pointer is a child rather than the node itself. Making file links workflow-capable instead would mean unpicking that invariant in the status area, the status submenu and the context menu.
- There is no filesystem watcher in the app, so live refresh is not a small addition. Rule 11 accepts staleness rather than introducing one.
- Paths are relative to the `.arbo` file's directory rather than a repository root, because Arborescent has no concept of a repository and cannot locate one.
- This is the first place the app renders third-party content as rich output. The webview provides isolation, but the sanitisation step is still load-bearing rather than decorative.

### Rejected alternatives

- **Mirroring a directory into nodes.** A node has to carry orchestration state — step position, session binding, decomposition lineage — that a directory has nowhere to store, so the projection can never be pure, and reconciling a renamed file against a node carrying live workflow state is a conflict model that fails at the worst moment. One link per story costs nothing by comparison.
- **Importing the file as a read-only node subtree using the existing markdown parser.** That needs no dependency, but `parseMarkdown` is heading-based and discards non-heading lines, so prose, tables and code fences would be destroyed — which hands back exactly what moving to files was meant to buy.
- **Opening the file's GitHub blob URL and letting GitHub render it.** Zero dependency and perfect fidelity, but only for content already committed and pushed, so useless while drafting.
- **Inlining file contents into step prompts.** The session can read a path with its own tools; inlining spends tokens on content the step may not need.

### Out of scope

Scanning a directory to create links in bulk; editing (story 004); diffing or reviewing (story 005); frontmatter; paths outside the `.arbo` file's directory tree; creating, renaming or deleting story files from Arborescent.
