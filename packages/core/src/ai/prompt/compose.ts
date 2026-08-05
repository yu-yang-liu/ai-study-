import type { TaskName, ChatMessage } from '../gateway/types';
import type { AppPhase } from '../../constants';
import { getPersona, personaSystemPrompt } from './persona';
import { getTaskInstruction } from './tasks';
import { schemaToFormatInstruction } from './format';
import type { RAGReference } from '../rag/types';

export interface ComposeOptions {
  task: TaskName;
  subject: string;
  phase: AppPhase;
  userInput?: string;
  references?: RAGReference[];
  learnerContext?: string;
}

/**
 * composePrompt = persona + task + format + references(RAG) + learner context
 */
export function composePrompt(opts: ComposeOptions): string {
  const parts: string[] = [];

  parts.push(personaSystemPrompt(opts.subject, opts.phase));
  parts.push(getTaskInstruction(opts.task));
  parts.push(schemaToFormatInstruction(opts.task));

  if (opts.references?.length) {
    const refText = opts.references
      .map(
        (r, i) =>
          `${i + 1}. \u8003\u70b9\uff1a${r.examPoint}\n   \u8bc4\u5206\u8981\u70b9\uff1a${r.analysis}`,
      )
      .join('\n');
    parts.push(`\u4ee5\u4e0b\u68c0\u7d22\u5230\u7684\u76f8\u5173\u8003\u70b9\u4e0e\u89e3\u6790\u53c2\u8003\uff1a\n${refText}`);
  }

  if (opts.learnerContext) {
    parts.push(`\u5b66\u751f\u5b66\u60c5\uff1a${opts.learnerContext}`);
  }

  if (opts.userInput) {
    parts.push(opts.userInput);
  }

  return parts.join('\n\n---\n\n');
}

export function composeMessages(opts: ComposeOptions): ChatMessage[] {
  const fullPrompt = composePrompt(opts);
  const persona = getPersona(opts.subject, opts.phase);
  return [
    { role: 'system', content: fullPrompt },
    {
      role: 'user',
      content: opts.userInput ?? `\u8bf7\u4ee5${persona.role}\u7684\u8eab\u4efd\uff0c\u5206\u6790\u4ee5\u4e0b\u5185\u5bb9`,
    },
  ];
}
