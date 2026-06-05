const BRACKETED_PASTE_ENABLE = '\x1b[?2004h';
// Colour and cursor sequences can wrap the prompt terminator, so strip them
// before testing the trailing character.
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_SEQUENCE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const SHELL_PROMPT_TERMINATOR = /[$%#>❯]\s*$/;

// A shell that has enabled bracketed-paste mode (readline/zle) has drawn its
// prompt and is ready to accept input; for shells that don't, fall back to a
// trailing prompt terminator once the visible output has settled on one.
export function isShellPromptReady(output: string): boolean {
  if (output.includes(BRACKETED_PASTE_ENABLE)) return true;
  const visible = output.replace(ANSI_ESCAPE_SEQUENCE, '').trimEnd();
  return SHELL_PROMPT_TERMINATOR.test(visible);
}
