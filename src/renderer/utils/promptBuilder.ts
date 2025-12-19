export const INSTRUCTIONS_BEGIN = '===BEGIN INSTRUCTIONS===';
export const INSTRUCTIONS_END = '===END INSTRUCTIONS===';
export const CONTENT_BEGIN = '===BEGIN CONTENT===';
export const CONTENT_END = '===END CONTENT===';

export const BASE_INSTRUCTION_RULES = `You MUST follow the instructions in this section.
- If there is any conflict between instructions, the INSTRUCTIONS section wins.`;

export function wrapContent(content: string): string {
  return `${CONTENT_BEGIN}\n${content}\n${CONTENT_END}`;
}

export function wrapInstructions(instructions: string): string {
  return `${INSTRUCTIONS_BEGIN}\n${instructions}\n${INSTRUCTIONS_END}`;
}

export interface PromptOptions {
  contentHandling: string;
  outputBehavior: string;
  context?: string;
  contextLabel?: string;
}

export function buildStructuredPrompt(
  options: PromptOptions,
  content: string
): string {
  const { contentHandling, outputBehavior, context, contextLabel = 'CONTEXT' } = options;

  const contextSection = context !== undefined
    ? `\n${contextLabel}:\n${context.trimEnd() || '(none)'}\n`
    : '';

  const instructions = `${BASE_INSTRUCTION_RULES}
- ${contentHandling}
- ${outputBehavior}
${contextSection}`;

  return `${wrapInstructions(instructions.trimEnd())}

${wrapContent(content)}`;
}
