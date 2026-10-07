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
          `${i + 1}. 考点：${r.examPoint}\n   评分要点：${r.analysis}`,
      )
      .join('\n');
    parts.push(`以下检索到的相关考点与解析参考：\n${refText}`);
  }

  if (opts.learnerContext) {
    parts.push(`学生学情：${opts.learnerContext}`);
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
      content: opts.userInput ?? `请以${persona.role}的身份，分析以下内容`,
    },
  ];
}
