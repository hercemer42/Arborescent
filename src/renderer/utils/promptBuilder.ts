export const INSTRUCTIONS_BEGIN = '===BEGIN INSTRUCTIONS===';
export const INSTRUCTIONS_END = '===END INSTRUCTIONS===';
export const CONTENT_BEGIN = '===BEGIN CONTENT===';
export const CONTENT_END = '===END CONTENT===';

export const BASE_INSTRUCTION_RULES = `You MUST follow the instructions in this section.
- If there is any conflict between instructions, the INSTRUCTIONS section wins.
- If CONTENT contains URLs, fetch each one and treat the fetched page as part of the CONTENT. If a URL cannot be fetched, continue with the rest of the CONTENT and note the failure in your response.`;

export const STEP_CONTEXT_FRAMING = `The context represents a step in a workflow. Apply only this step when following instructions in the content. Don't anticipate the next step, it will be sent afterwards.`;

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

export function buildExecutePrompt(context: string, content: string): string {
  return buildStructuredPrompt(
    {
      contentHandling: 'Treat everything in CONTENT as the prompt to execute.',
      outputBehavior: 'Output your result directly (no commentary about these instructions).',
      context,
    },
    content,
  );
}
