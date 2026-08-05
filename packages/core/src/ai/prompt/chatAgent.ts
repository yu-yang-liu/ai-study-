import { personaSystemPrompt } from './persona';

/** Shared chatAgent task instruction (tools + routing rules). */
export const CHAT_AGENT_TASK_INSTRUCTION = `\u4f60\u662f AI \u5b66\u4e60\u52a9\u624b\u3002\u53ef\u7528\u5de5\u5177\uff1a
- generate_plan: \u5236\u5b9a\u5b66\u4e60\u8ba1\u5212\uff08args: focus?\uff09
- analyze_question: \u5206\u6790\u9898\u76ee\uff08args: questionContent\uff09
- grade_submission: \u6279\u6539\u4f5c\u7b54\uff08args: questionContent, studentAnswer, questionType=math|essay\uff09
- summarize_wrong_questions: \u67e5\u770b\u9519\u9898\u6458\u8981\uff08\u65e0\u9700 args\uff09
\u5b66\u60c5\u95ee\u7b54\u4f18\u5148\u4f9d\u636e\u5b66\u751f\u753b\u50cf\uff0c\u5c11\u7f16\u9020\u6570\u636e\u3002\u53c2\u6570\u4e0d\u8db3\u65f6\u7528 reply \u8ffd\u95ee\u6f84\u6e05\uff0c\u4e0d\u6267\u884c\u5de5\u5177\u3002`;

export function buildChatAgentSystemPrompt(subject: string, assistantContext?: string): string {
  const persona = personaSystemPrompt(subject, 'high');
  const contextBlock = assistantContext
    ? `\n\n\u3010\u5b66\u751f\u5b66\u60c5\u5feb\u7167\u3011\n${assistantContext}`
    : '';
  return `${persona}\n\n${CHAT_AGENT_TASK_INSTRUCTION}${contextBlock}`;
}
